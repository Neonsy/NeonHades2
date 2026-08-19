return function(context)
	local game = context.game
	local json_array = context.json_array
	local safe_copy = context.safe_copy
	local sorted_keys = context.sorted_keys
	local sorted_set_values = context.sorted_set_values
	local bytewise_less = context.bytewise_less
	local collect_mechanics = context.collect_mechanics
	local collect_samples = context.collect_samples

	local RANK_RARITIES = { "Common", "Rare", "Epic" }
	local RANK_RARITY_SET = { Common = true, Rare = true, Epic = true }

	local function require_localized(localization, id, require_description)
		local localized = localization[id]
		if not localized or type(localized.display_name) ~= "string" or localized.display_name == "" then
			error("Missing official English Arcana text for " .. id)
		end
		if require_description and (type(localized.description) ~= "string" or localized.description == "") then
			error("Missing official English Arcana description for " .. id)
		end
		return localized
	end

	local function costs(value, path)
		local result = {}
		for _, resource_id in ipairs(sorted_keys(value or {})) do
			local amount = value[resource_id]
			if type(resource_id) ~= "string" or type(amount) ~= "number" or amount < 0 then
				error(path .. " contains an invalid resource cost")
			end
			table.insert(result, { resourceId = resource_id, amount = amount })
		end
		return json_array(result)
	end

	local function collect_layout()
		local layout = {}
		local positions = {}
		for row, row_data in ipairs(game.MetaUpgradeDefaultCardLayout or {}) do
			if type(row_data) ~= "table" then error("Arcana layout row is not a table") end
			for column, card_id in ipairs(row_data) do
				if type(card_id) ~= "string" or positions[card_id] then
					error("Arcana layout contains an invalid or duplicate card identifier")
				end
				positions[card_id] = { row = row, column = column }
				table.insert(layout, { row = row, column = column, cardId = card_id })
			end
		end
		if #layout ~= 25 then error("Expected 25 Arcana Cards in the default layout") end
		return json_array(layout), positions
	end

	local function adjacent_card_ids(layout, row, column)
		local ids = {}
		local coordinates = {
			{ row, column - 1 },
			{ row, column + 1 },
			{ row - 1, column },
			{ row + 1, column },
		}
		for _, coordinate in ipairs(coordinates) do
			local row_data = layout[coordinate[1]]
			local card_id = row_data and row_data[coordinate[2]]
			if type(card_id) == "string" then ids[card_id] = true end
		end
		return sorted_set_values(ids)
	end

	local function referenced_trait_fields(description, trait_id)
		local fields = {}
		for referenced_trait_id, field in string.gmatch(
			description,
			"%$TraitData%.([%w_]+)%.([%w_]+)"
		) do
			if referenced_trait_id ~= trait_id then
				error(
					"Arcana description for " .. trait_id
						.. " references another trait " .. referenced_trait_id .. "." .. field
				)
			end
			fields[field] = true
		end
		return fields
	end

	local function collect_grasp(localization)
		local localized = require_localized(localization, "IncreaseMetaUpgradeCard", true)
		local cost_data = game.MetaUpgradeCostData
		if type(cost_data) ~= "table" or type(cost_data.StartingMetaUpgradeLimit) ~= "number"
			or type(cost_data.MetaUpgradeLevelData) ~= "table" then
			error("Processed MetaUpgradeCostData is incomplete")
		end
		local capacity = cost_data.StartingMetaUpgradeLimit
		local levels = {}
		for index, level_data in ipairs(cost_data.MetaUpgradeLevelData) do
			if type(level_data) ~= "table" or type(level_data.CostIncrease) ~= "number"
				or level_data.CostIncrease <= 0 then
				error("MetaUpgradeCostData level " .. index .. " is invalid")
			end
			capacity = capacity + level_data.CostIncrease
			table.insert(levels, {
				level = index,
				capacityIncrease = level_data.CostIncrease,
				cumulativeCapacity = capacity,
				costs = costs(level_data.ResourceCost, "MetaUpgradeCostData.MetaUpgradeLevelData[" .. index .. "].ResourceCost"),
			})
		end
		return {
			id = "IncreaseMetaUpgradeCard",
			displayName = localized.display_name,
			description = localized.description,
			startingCapacity = cost_data.StartingMetaUpgradeLimit,
			levels = json_array(levels),
			evidence = {
				localizationPath = localized.path .. ":IncreaseMetaUpgradeCard",
				runtimePaths = json_array({ "MetaUpgradeCostData" }),
			},
		}
	end

	local function collect_cards(localization, positions)
		local cards = {}
		for _, card_id in ipairs(sorted_keys(positions)) do
			local position = positions[card_id]
			local card = game.MetaUpgradeCardData[card_id]
			if type(card) ~= "table" then
				error("Missing processed MetaUpgradeCardData." .. card_id)
			end
			local trait_id = card.TraitName
			local trait = type(trait_id) == "string" and game.TraitData[trait_id] or nil
			if type(trait) ~= "table" then
				error("Arcana Card " .. card_id .. " has no processed trait")
			end
			local localized = require_localized(localization, card_id, true)
			local auto_text = nil
			if card.AutoEquipText ~= nil then
				if type(card.AutoEquipText) ~= "string" then error("Arcana auto-activation text id is invalid") end
				auto_text = require_localized(localization, card.AutoEquipText, false)
			end
			if type(card.Cost) ~= "number" or card.Cost < 0 then
				error("Arcana Card " .. card_id .. " has an invalid Grasp cost")
			end
			if type(card.UpgradeResourceCost) ~= "table" or #card.UpgradeResourceCost ~= 2 then
				error("Arcana Card " .. card_id .. " must have two rank upgrade costs")
			end
			local ranks = {}
			for rank, rarity in ipairs(RANK_RARITIES) do
				local upgrade_cost = rank == 1 and nil or card.UpgradeResourceCost[rank - 1]
				table.insert(ranks, {
					rank = rank,
					rarity = rarity,
					upgradeFromPreviousCosts = costs(
						upgrade_cost,
						"MetaUpgradeCardData." .. card_id .. ".UpgradeResourceCost[" .. (rank - 1) .. "]"
					),
					runtimePath = "TraitData." .. trait_id .. ".RarityLevels." .. rarity,
				})
			end
			local required_card_ids = {}
			for _, required_id in ipairs(card.RequiredCardNames or {}) do
				if type(required_id) ~= "string" or not positions[required_id] then
					error("Arcana Card " .. card_id .. " has an invalid related card id")
				end
				required_card_ids[required_id] = true
			end
			local runtime_paths = {
				["MetaUpgradeCardData." .. card_id] = true,
				["MetaUpgradeDefaultCardLayout[" .. position.row .. "][" .. position.column .. "]"] = true,
				["TraitData." .. trait_id] = true,
			}
			table.insert(cards, {
				id = card_id,
				row = position.row,
				column = position.column,
				displayName = localized.display_name,
				description = localized.description,
				traitId = trait_id,
				type = type(card.Type) == "string" and card.Type or context.json_null,
				graspCost = card.Cost,
				unlockCosts = costs(card.ResourceCost, "MetaUpgradeCardData." .. card_id .. ".ResourceCost"),
				ranks = json_array(ranks),
				autoActivationRequirements = card.AutoEquipRequirements
					and safe_copy(card.AutoEquipRequirements, "MetaUpgradeCardData." .. card_id .. ".AutoEquipRequirements")
					or {},
				autoActivationText = auto_text and auto_text.display_name or context.json_null,
				relatedCardIds = sorted_set_values(required_card_ids),
				unlock = {
					initiallyRevealable = position.row == 1 and position.column == 1,
					adjacentCardIds = adjacent_card_ids(
						game.MetaUpgradeDefaultCardLayout,
						position.row,
						position.column
					),
				},
				mechanics = collect_mechanics(
					trait,
					trait_id,
					referenced_trait_fields(localized.description, trait_id)
				),
				rankEffects = collect_samples(trait_id, trait, {
					rarities = RANK_RARITY_SET,
					maximum_level = 1,
				}),
				evidence = {
					localizationPath = localized.path .. ":" .. card_id,
					runtimePaths = sorted_set_values(runtime_paths),
				},
			})
		end
		table.sort(cards, function(left, right) return bytewise_less(left.id, right.id) end)
		return json_array(cards)
	end

	local function create_report(package_version, localization)
		local layout, positions = collect_layout()
		return {
			schema = "neodes2-arcana-runtime-1",
			exporterVersion = context.exporter_version,
			generatedAtUnixSeconds = os.time(),
			language = "en",
			game = {
				steamBuildId = context.config.steam_build_id,
				executableVersion = context.config.executable_version,
				packageVersion = package_version,
				acquisitionId = context.config.acquisition_id,
				sourceManifestSha256 = context.config.source_manifest_sha256,
			},
			sourceTables = json_array({
				"MetaUpgradeCardData",
				"MetaUpgradeCostData",
				"MetaUpgradeDefaultCardLayout",
				"TraitData",
			}),
			localizationFiles = json_array({ "Content/Game/Text/en/TraitText.en.sjson" }),
			unlockModel = {
				kind = "orthogonal-adjacency",
				startingCardId = "ChanneledCast",
				layoutMutableAfterUnlock = true,
			},
			layout = layout,
			grasp = collect_grasp(localization),
			cards = collect_cards(localization, positions),
		}
	end

	return { create_report = create_report }
end
