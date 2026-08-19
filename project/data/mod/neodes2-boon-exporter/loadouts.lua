return function(context)
	local game = context.game
	local json_array = context.json_array
	local json_null = context.json_null
	local safe_copy = context.safe_copy
	local sorted_keys = context.sorted_keys
	local sorted_set_values = context.sorted_set_values
	local bytewise_less = context.bytewise_less
	local collect_samples = context.collect_samples

	local KEEPSAKE_RARITIES = { Common = true, Rare = true, Epic = true }

	local function require_localized(localization, id, require_description)
		local localized = localization[id]
		if not localized or type(localized.display_name) ~= "string" or localized.display_name == "" then
			error("Missing official English loadout-system text for " .. id)
		end
		if require_description and (type(localized.description) ~= "string" or localized.description == "") then
			error("Missing official English loadout-system description for " .. id)
		end
		return localized
	end

	local function copy_or_empty(value, path)
		return value == nil and {} or safe_copy(value, path)
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

	local function is_presentation_field(key)
		return type(key) == "string" and (
			string.find(key, "VoiceLines", 1, true) ~= nil
			or string.find(key, "Animation", 1, true) ~= nil
			or string.find(key, "Sound", 1, true) ~= nil
			or string.find(key, "Portrait", 1, true) ~= nil
			or string.find(key, "Subtitle", 1, true) ~= nil
			or string.find(key, "Camera", 1, true) ~= nil
			or string.find(key, "Fx", 1, true) ~= nil
			or string.find(key, "Vfx", 1, true) ~= nil
			or key == "Icon"
		)
	end

	local function filtered_mechanic_copy(value, path, ancestors, depth)
		local value_type = type(value)
		if value_type == "string" or value_type == "boolean" then return value end
		if value_type == "number" then
			if value ~= value or value == math.huge or value == -math.huge then return json_null end
			return value
		end
		if value_type ~= "table" or depth > 32 or ancestors[value] then return json_null end
		ancestors[value] = true
		local numeric_count = 0
		local string_count = 0
		local maximum = 0
		for key in pairs(value) do
			if type(key) == "number" and key > 0 and key % 1 == 0 then
				numeric_count = numeric_count + 1
				maximum = math.max(maximum, key)
			elseif type(key) == "string" then
				string_count = string_count + 1
			end
		end
		local is_array = numeric_count > 0 and string_count == 0 and maximum == numeric_count
		local result = is_array and json_array({}) or {}
		if is_array then
			for index = 1, #value do
				result[index] = filtered_mechanic_copy(value[index], path .. "[" .. index .. "]", ancestors, depth + 1)
			end
		else
			for _, key in ipairs(sorted_keys(value)) do
				if type(key) == "string" and not is_presentation_field(key) then
					result[key] = filtered_mechanic_copy(value[key], path .. "." .. key, ancestors, depth + 1)
				end
			end
		end
		ancestors[value] = nil
		return result
	end

	local function mechanics(value, path)
		return filtered_mechanic_copy(value or {}, path, {}, 0)
	end

	local function collect_keepsakes(localization)
		local keepsakes = {}
		local seen_traits = {}
		for _, relationship_id in ipairs(sorted_keys(game.GiftData or {})) do
			local gift_data = game.GiftData[relationship_id]
			local first_gift = type(gift_data) == "table" and gift_data[1] or nil
			local trait_id = type(first_gift) == "table" and first_gift.Gift or nil
			if type(trait_id) == "string" then
				if seen_traits[trait_id] then error("Keepsake trait is awarded by more than one relationship: " .. trait_id) end
				seen_traits[trait_id] = true
				local trait = game.TraitData[trait_id]
				if type(trait) ~= "table" then error("GiftData." .. relationship_id .. " references missing TraitData." .. trait_id) end
				local localized = require_localized(localization, trait_id, true)
				local relationship_text = localization[relationship_id]
				local thresholds = trait.ChamberThresholds or { 25, 50 }
				if type(thresholds) ~= "table" or #thresholds ~= 2 then
					error("Keepsake " .. trait_id .. " must have two chamber thresholds")
				end
				table.insert(keepsakes, {
					id = trait_id,
					displayName = localized.display_name,
					description = localized.description,
					relationshipId = relationship_id,
					relationshipName = relationship_text and relationship_text.display_name or relationship_id,
					acquisitionRequirements = copy_or_empty(
						first_gift.GameStateRequirements,
						"GiftData." .. relationship_id .. "[1].GameStateRequirements"
					),
					chamberThresholds = safe_copy(thresholds, "TraitData." .. trait_id .. ".ChamberThresholds"),
					naturalRanks = json_array({ "Common", "Rare", "Epic" }),
					temporaryBonusRank = trait.RarityLevels and trait.RarityLevels.Heroic and "Heroic" or context.json_null,
					mechanics = mechanics(trait, "TraitData." .. trait_id),
					rankEffects = collect_samples(trait_id, trait, {
						rarities = KEEPSAKE_RARITIES,
						maximum_level = 1,
					}),
					evidence = {
						localizationPath = localized.path .. ":" .. trait_id,
						runtimePaths = json_array({
							"GiftData." .. relationship_id .. "[1]",
							"TraitData." .. trait_id,
						}),
					},
				})
			end
		end
		table.sort(keepsakes, function(left, right) return bytewise_less(left.id, right.id) end)
		if #keepsakes == 0 then error("No runtime keepsakes were found") end
		return json_array(keepsakes)
	end

	local function collect_familiar_upgrades(familiar_id, localization)
		local groups = {}
		for _, item_id in ipairs(sorted_keys(game.FamiliarShopItemData or {})) do
			local item = game.FamiliarShopItemData[item_id]
			if type(item) == "table" and item.DebugOnly ~= true and item.FamiliarName == familiar_id then
				local group_id = item.ShowLastInGroup
				local rank = item.RarityLevel or 1
				local trait_id = item.IncreaseTraitLevel
				if type(group_id) ~= "string" or type(trait_id) ~= "string"
					or type(rank) ~= "number" or rank < 1 or rank > 3 or rank % 1 ~= 0 then
					error("FamiliarShopItemData." .. item_id .. " has incomplete processed upgrade data")
				end
				local group = groups[group_id]
				if group == nil then
					group = { trait_id = trait_id, ranks = {} }
					groups[group_id] = group
				elseif group.trait_id ~= trait_id then
					error("Familiar upgrade group " .. group_id .. " changes trait identifier")
				end
				if group.ranks[rank] then error("Familiar upgrade group " .. group_id .. " repeats rank " .. rank) end
				group.ranks[rank] = { id = item_id, data = item }
			end
		end

		local output = {}
		for _, group_id in ipairs(sorted_keys(groups)) do
			local group = groups[group_id]
			local trait = game.TraitData[group.trait_id]
			if type(trait) ~= "table" then error("Familiar upgrade " .. group_id .. " references missing trait") end
			local localized = require_localized(localization, group_id, true)
			local ranks = {}
			for rank = 1, 3 do
				local ranked = group.ranks[rank]
				if ranked == nil then error("Familiar upgrade " .. group_id .. " is missing rank " .. rank) end
				table.insert(ranks, {
					rank = rank,
					itemId = ranked.id,
					costs = json_array({ { resourceId = "FamiliarPoints", amount = 1 } }),
					requirements = copy_or_empty(
						ranked.data.GameStateRequirements,
						"FamiliarShopItemData." .. ranked.id .. ".GameStateRequirements"
					),
					runtimePath = "FamiliarShopItemData." .. ranked.id,
				})
			end
			table.insert(output, {
				id = group_id,
				displayName = localized.display_name,
				description = localized.description,
				traitId = group.trait_id,
				ranks = json_array(ranks),
				mechanics = mechanics(trait, "TraitData." .. group.trait_id),
				rankEffects = collect_samples(group.trait_id, trait, { maximum_level = 3 }),
				evidence = {
					localizationPath = localized.path .. ":" .. group_id,
					runtimePaths = json_array({
						"FamiliarShopItemData." .. group_id,
						"TraitData." .. group.trait_id,
					}),
				},
			})
		end
		if #output ~= 3 then error("Expected three upgrade tracks for " .. familiar_id .. ", found " .. #output) end
		return json_array(output)
	end

	local function collect_familiars(localization)
		local familiars = {}
		local seen = {}
		for _, familiar_id in ipairs(game.FamiliarOrderData or {}) do
			if type(familiar_id) ~= "string" or seen[familiar_id] then error("FamiliarOrderData is invalid") end
			seen[familiar_id] = true
			local familiar = game.FamiliarData[familiar_id]
			if type(familiar) ~= "table" then error("Missing FamiliarData." .. familiar_id) end
			local localized = require_localized(localization, familiar_id, false)
			local primary_trait_id = type(familiar.TraitNames) == "table" and familiar.TraitNames[1] or nil
			local primary_trait = type(primary_trait_id) == "string" and game.TraitData[primary_trait_id] or nil
			local flavor_text_id = type(primary_trait) == "table" and primary_trait.FlavorText or nil
			local flavor_text = type(flavor_text_id) == "string" and require_localized(localization, flavor_text_id, false) or nil
			if flavor_text == nil then error("Missing official English Familiar flavor text for " .. familiar_id) end
			table.insert(familiars, {
				id = familiar_id,
				displayName = localized.display_name,
				description = flavor_text.display_name,
				unlockRequirements = copy_or_empty(
					familiar.GameStateRequirements,
					"FamiliarData." .. familiar_id .. ".GameStateRequirements"
				),
				mechanics = mechanics(familiar, "FamiliarData." .. familiar_id),
				upgrades = collect_familiar_upgrades(familiar_id, localization),
				evidence = {
					localizationPath = localized.path .. ":" .. familiar_id,
					runtimePaths = json_array({
						"FamiliarData." .. familiar_id,
						"FamiliarOrderData",
					}),
				},
			})
		end
		if #familiars ~= 5 then error("Expected five runtime Familiars, found " .. #familiars) end
		return json_array(familiars)
	end

	local function collect_hexes(localization)
		local hexes = {}
		local seen_traits = {}
		for _, spell_id in ipairs(sorted_keys(game.SpellData or {})) do
			local spell = game.SpellData[spell_id]
			local trait_id = type(spell) == "table" and spell.TraitName or nil
			if type(trait_id) == "string" then
				if seen_traits[trait_id] then error("Hex trait is referenced by more than one spell: " .. trait_id) end
				seen_traits[trait_id] = true
				local trait = game.TraitData[trait_id]
				if type(trait) ~= "table" then error("SpellData." .. spell_id .. " references missing TraitData." .. trait_id) end
				local localized = require_localized(localization, trait_id, true)
				local talent_ids = {}
				local talents = {}
				for _, category in ipairs({ "Repeatable", "Unique", "Legendary" }) do
					for _, talent_id in ipairs(spell.Talents and spell.Talents[category] or {}) do
						if type(talent_id) ~= "string" or talent_ids[talent_id] then
							error("SpellData." .. spell_id .. " has an invalid or duplicate talent")
						end
						talent_ids[talent_id] = true
						local talent_trait = game.TraitData[talent_id]
						if type(talent_trait) ~= "table" then error("Missing TraitData." .. talent_id) end
						local talent_text = require_localized(localization, talent_id, true)
						table.insert(talents, {
							id = talent_id,
							category = category,
							displayName = talent_text.display_name,
							description = talent_text.description,
							mechanics = mechanics(talent_trait, "TraitData." .. talent_id),
							effects = collect_samples(talent_id, talent_trait, { maximum_level = 3 }),
							evidence = {
								localizationPath = talent_text.path .. ":" .. talent_id,
								runtimePaths = json_array({
									"SpellData." .. spell_id .. ".Talents." .. category,
									"TraitData." .. talent_id,
								}),
							},
						})
					end
				end
				table.sort(talents, function(left, right) return bytewise_less(left.id, right.id) end)
				table.insert(hexes, {
					id = spell_id,
					traitId = trait_id,
					displayName = localized.display_name,
					description = localized.description,
					availabilityRequirements = copy_or_empty(
						spell.GameStateRequirements,
						"SpellData." .. spell_id .. ".GameStateRequirements"
					),
					spellData = mechanics(spell, "SpellData." .. spell_id),
					mechanics = mechanics(trait, "TraitData." .. trait_id),
					baseEffects = collect_samples(trait_id, trait, { maximum_level = 1 }),
					talents = json_array(talents),
					evidence = {
						localizationPath = localized.path .. ":" .. trait_id,
						runtimePaths = json_array({
							"SpellData." .. spell_id,
							"TraitData." .. trait_id,
						}),
					},
				})
			end
		end
		table.sort(hexes, function(left, right) return bytewise_less(left.id, right.id) end)
		if #hexes ~= 9 then error("Expected nine runtime Hexes, found " .. #hexes) end
		return json_array(hexes)
	end

	local function collect_incantations(localization)
		local automatic = {}
		for _, upgrade_id in ipairs(game.GameData.WorldUpgradeAutomaticUnlocks or {}) do
			if type(upgrade_id) ~= "string" then error("WorldUpgradeAutomaticUnlocks contains an invalid identifier") end
			automatic[upgrade_id] = true
		end
		local incantations = {}
		local incantation_ids = {}
		for _, upgrade_id in ipairs(sorted_keys(game.WorldUpgradeData or {})) do
			local upgrade = game.WorldUpgradeData[upgrade_id]
			local localized = localization[upgrade_id]
			if string.sub(upgrade_id, 1, 12) == "WorldUpgrade"
				and type(upgrade) == "table" and upgrade.DebugOnly ~= true and localized
				and type(localized.display_name) == "string" and localized.display_name ~= ""
				and type(localized.description) == "string" and localized.description ~= "" then
				incantation_ids[upgrade_id] = true
				table.insert(incantations, {
					id = upgrade_id,
					displayName = localized.display_name,
					description = localized.description,
					automaticUnlock = automatic[upgrade_id] == true,
					costs = costs(upgrade.Cost, "WorldUpgradeData." .. upgrade_id .. ".Cost"),
					unlockRequirements = copy_or_empty(
						upgrade.GameStateRequirements,
						"WorldUpgradeData." .. upgrade_id .. ".GameStateRequirements"
					),
					effects = mechanics(upgrade, "WorldUpgradeData." .. upgrade_id),
					evidence = {
						localizationPath = localized.path .. ":" .. upgrade_id,
						runtimePaths = json_array({ "WorldUpgradeData." .. upgrade_id }),
					},
				})
			end
		end
		if #incantations == 0 then error("No runtime incantations were found") end
		local automatic_incantations = {}
		for upgrade_id in pairs(automatic) do
			if incantation_ids[upgrade_id] then automatic_incantations[upgrade_id] = true end
		end
		return json_array(incantations), sorted_set_values(automatic_incantations)
	end

	local function create_report(package_version, localization)
		local incantations, automatic_unlocks = collect_incantations(localization)
		return {
			schema = "neodes2-loadout-runtime-1",
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
				"FamiliarData",
				"FamiliarOrderData",
				"FamiliarShopItemData",
				"GameData.WorldUpgradeAutomaticUnlocks",
				"GiftData",
				"SpellData",
				"SpellTalentData",
				"TraitData",
				"WorldUpgradeData",
			}),
			localizationFiles = json_array({
				"Content/Game/Text/en/HelpText.en.sjson",
				"Content/Game/Text/en/TraitText.en.sjson",
				"Content/Game/Text/en/_FamiliarData.en.sjson",
				"Content/Game/Text/en/_KeepsakeData.en.sjson",
				"Content/Game/Text/en/_TraitData_Keepsake.en.sjson",
				"Content/Game/Text/en/_TraitData_Spell.en.sjson",
				"Content/Game/Text/en/_WorldUpgradeData.en.sjson",
			}),
			keepsakes = collect_keepsakes(localization),
			familiars = collect_familiars(localization),
			hexes = collect_hexes(localization),
			incantations = incantations,
			automaticWorldUpgradeIds = automatic_unlocks,
			spellTalentConfiguration = mechanics(game.SpellTalentData, "SpellTalentData"),
		}
	end

	return { create_report = create_report }
end
