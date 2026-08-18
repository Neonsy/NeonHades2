return function(context)
	local game = context.game
	local json_array = context.json_array
	local safe_copy = context.safe_copy
	local sorted_keys = context.sorted_keys
	local sorted_set_values = context.sorted_set_values
	local bytewise_less = context.bytewise_less
	local collect_samples = context.collect_samples

	local RANK_RARITIES = { "Common", "Rare", "Epic", "Heroic", "Legendary" }
	local FAMILY_IDS = {
		WeaponStaffSwing = true,
		WeaponDagger = true,
		WeaponTorch = true,
		WeaponAxe = true,
		WeaponLob = true,
		WeaponSuit = true,
	}
	local RANK_RARITY_SET = {
		Common = true,
		Rare = true,
		Epic = true,
		Heroic = true,
		Legendary = true,
	}

	local function require_localized(localization, id)
		local localized = localization[id]
		if not localized or type(localized.display_name) ~= "string" or localized.display_name == ""
			or type(localized.description) ~= "string" or localized.description == "" then
			error("Missing official English weapon-domain text for " .. id)
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

	local function requirements(value, path)
		if value == nil then return {} end
		return safe_copy(value, path)
	end

	local function full_mechanics(trait, trait_id)
		local mechanics = {}
		for _, key in ipairs(sorted_keys(trait)) do
			if type(key) == "string" then
				mechanics[key] = safe_copy(trait[key], "TraitData." .. trait_id .. "." .. key)
			end
		end
		return mechanics
	end

	local function collect_aspect_tables(localization)
		local aspects = {}
		local ids_by_weapon = {}
		for _, trait_id in ipairs(sorted_keys(game.TraitData)) do
			local trait = game.TraitData[trait_id]
			if type(trait_id) == "string" and type(trait) == "table"
				and trait.IsWeaponEnchantment == true and FAMILY_IDS[trait.RequiredWeapon] then
				local weapon_id = trait.RequiredWeapon
				ids_by_weapon[weapon_id] = ids_by_weapon[weapon_id] or {}
				ids_by_weapon[weapon_id][trait_id] = true
				table.insert(aspects, { id = trait_id, weapon_id = weapon_id, trait = trait })
			end
		end
		for weapon_id in pairs(FAMILY_IDS) do
			local count = 0
			for _ in pairs(ids_by_weapon[weapon_id] or {}) do count = count + 1 end
			if count ~= 4 then
				error("Expected four runtime aspects for " .. weapon_id .. ", found " .. count)
			end
		end
		table.sort(aspects, function(left, right) return bytewise_less(left.id, right.id) end)

		local output = {}
		for _, aspect in ipairs(aspects) do
			local localized = require_localized(localization, aspect.id)
			local unlock_item = game.WeaponShopItemData[aspect.id]
			local base_aspect = unlock_item == nil
			local ranks = {}
			for rank, rarity in ipairs(RANK_RARITIES) do
				local shop_item_id
				if rank == 1 then
					if not base_aspect then shop_item_id = aspect.id end
				else
					shop_item_id = aspect.id .. tostring(rank)
				end
				local shop_item = shop_item_id and game.WeaponShopItemData[shop_item_id] or nil
				if rank > 1 and (type(shop_item) ~= "table" or shop_item.TraitUpgrade ~= aspect.id) then
					error("Missing rank shop item " .. tostring(shop_item_id) .. " for " .. aspect.id)
				end
				table.insert(ranks, {
					rank = rank,
					rarity = rarity,
					shopItemId = shop_item_id or context.json_null,
					costs = costs(shop_item and shop_item.Cost, "WeaponShopItemData." .. tostring(shop_item_id) .. ".Cost"),
					requirements = requirements(
						shop_item and shop_item.GameStateRequirements,
						"WeaponShopItemData." .. tostring(shop_item_id) .. ".GameStateRequirements"
					),
					runtimePath = "TraitData." .. aspect.id .. ".RarityLevels." .. rarity,
				})
			end
			local evidence_paths = { ["TraitData." .. aspect.id] = true }
			if not base_aspect then evidence_paths["WeaponShopItemData." .. aspect.id] = true end
			table.insert(output, {
				id = aspect.id,
				weaponId = aspect.weapon_id,
				displayName = localized.display_name,
				description = localized.description,
				baseAspect = base_aspect,
				ranks = json_array(ranks),
				mechanics = full_mechanics(aspect.trait, aspect.id),
				samples = collect_samples(aspect.id, aspect.trait, {
					rarities = RANK_RARITY_SET,
					maximum_level = 1,
				}),
				evidence = {
					localizationPath = localized.path .. ":" .. aspect.id,
					runtimePaths = sorted_set_values(evidence_paths),
				},
			})
		end
		return json_array(output), ids_by_weapon
	end

	local function collect_hammer_tables(localization)
		local hammers = {}
		local hammer_ids = {}
		for _, trait_id in ipairs(sorted_keys(game.TraitData)) do
			local trait = game.TraitData[trait_id]
			local localized = localization[trait_id]
			if type(trait_id) == "string" and type(trait) == "table"
				and trait.IsHammerTrait == true and FAMILY_IDS[trait.CodexWeapon]
				and localized and type(localized.display_name) == "string"
				and type(localized.description) == "string" then
				hammer_ids[trait_id] = true
				table.insert(hammers, { id = trait_id, weapon_id = trait.CodexWeapon, trait = trait })
			end
		end
		table.sort(hammers, function(left, right) return bytewise_less(left.id, right.id) end)
		return hammers, hammer_ids
	end

	local function path_contains(path, target)
		if type(path) ~= "table" then return false end
		for _, value in ipairs(path) do
			if value == target then return true end
		end
		return false
	end

	local function add_values(target, values)
		if type(values) == "string" then
			target[values] = true
		elseif type(values) == "table" then
			for _, value in ipairs(values) do
				if type(value) == "string" then target[value] = true end
			end
		end
	end

	local function scan_compatibility(value, weapon_id, result, ancestors)
		if type(value) ~= "table" or ancestors[value] then return end
		ancestors[value] = true
		local path = value.Path
		if path_contains(path, "LastWeaponUpgradeName") and path[#path] == weapon_id then
			add_values(result.excluded, value.IsNone)
			add_values(result.excluded, value.HasNone)
			add_values(result.required, value.IsAny)
			add_values(result.required, value.HasAny)
		elseif path_contains(path, "TraitDictionary") then
			add_values(result.conflicts, value.HasNone)
			add_values(result.conflicts, value.IsNone)
		end
		for _, key in ipairs(sorted_keys(value)) do
			if type(value[key]) == "table" then
				scan_compatibility(value[key], weapon_id, result, ancestors)
			end
		end
		ancestors[value] = nil
	end

	local function compatibility(trait, weapon_id, aspect_ids, hammer_ids)
		local found = { excluded = {}, required = {}, conflicts = {} }
		scan_compatibility(trait.GameStateRequirements, weapon_id, found, {})
		local allowed = {}
		if next(found.required) then
			for aspect_id in pairs(found.required) do allowed[aspect_id] = true end
		else
			for aspect_id in pairs(aspect_ids) do allowed[aspect_id] = true end
		end
		for aspect_id in pairs(found.excluded) do allowed[aspect_id] = nil end
		local filtered_conflicts = {}
		for trait_id in pairs(found.conflicts) do
			if hammer_ids[trait_id] then filtered_conflicts[trait_id] = true end
		end
		return {
			allowedAspectIds = sorted_set_values(allowed),
			excludedAspectIds = sorted_set_values(found.excluded),
			requiredAspectIds = sorted_set_values(found.required),
			incompatibleHammerIds = sorted_set_values(filtered_conflicts),
		}
	end

	local function collect_hammers(localization, ids_by_weapon)
		local hammers, hammer_ids = collect_hammer_tables(localization)
		local counts = {}
		local output = {}
		for _, hammer in ipairs(hammers) do
			counts[hammer.weapon_id] = (counts[hammer.weapon_id] or 0) + 1
			local localized = require_localized(localization, hammer.id)
			table.insert(output, {
				id = hammer.id,
				weaponId = hammer.weapon_id,
				displayName = localized.display_name,
				description = localized.description,
				requirements = requirements(
					hammer.trait.GameStateRequirements,
					"TraitData." .. hammer.id .. ".GameStateRequirements"
				),
				compatibility = compatibility(
					hammer.trait,
					hammer.weapon_id,
					ids_by_weapon[hammer.weapon_id],
					hammer_ids
				),
				mechanics = full_mechanics(hammer.trait, hammer.id),
				samples = collect_samples(hammer.id, hammer.trait, { maximum_level = 1 }),
				evidence = {
					localizationPath = localized.path .. ":" .. hammer.id,
					runtimePaths = json_array({ "TraitData." .. hammer.id }),
				},
			})
		end
		for weapon_id in pairs(FAMILY_IDS) do
			if not counts[weapon_id] then error("No runtime Hammers found for " .. weapon_id) end
		end
		return json_array(output)
	end

	local function collect_weapons(localization)
		local weapons = {}
		for _, weapon_id in ipairs(sorted_keys(FAMILY_IDS)) do
			local localized = require_localized(localization, weapon_id)
			local shop_item = game.WeaponShopItemData[weapon_id]
			if type(shop_item) ~= "table" then error("Missing WeaponShopItemData." .. weapon_id) end
			local linked_weapon_ids = {}
			for _, linked_id in ipairs(game.WeaponSets.HeroWeaponSets[weapon_id] or {}) do
				linked_weapon_ids[linked_id] = true
			end
			local weapon_data_ids = { [weapon_id] = true }
			local linked_ids_without_weapon_data = {}
			for linked_id in pairs(linked_weapon_ids) do
				if type(game.WeaponData[linked_id]) == "table" then
					weapon_data_ids[linked_id] = true
				else
					linked_ids_without_weapon_data[linked_id] = true
				end
			end
			local weapon_data = {}
			local evidence_paths = {
				["WeaponSets.HeroWeaponSets." .. weapon_id] = true,
				["WeaponShopItemData." .. weapon_id] = true,
			}
			for _, data_id in ipairs(sorted_keys(weapon_data_ids)) do
				weapon_data[data_id] = safe_copy(game.WeaponData[data_id], "WeaponData." .. data_id)
				evidence_paths["WeaponData." .. data_id] = true
			end
			table.insert(weapons, {
				id = weapon_id,
				displayName = localized.display_name,
				description = localized.description,
				unlockCosts = costs(shop_item.Cost, "WeaponShopItemData." .. weapon_id .. ".Cost"),
				unlockRequirements = requirements(
					shop_item.GameStateRequirements,
					"WeaponShopItemData." .. weapon_id .. ".GameStateRequirements"
				),
				linkedWeaponIds = sorted_set_values(linked_weapon_ids),
				linkedIdsWithoutWeaponData = sorted_set_values(linked_ids_without_weapon_data),
				weaponDataIds = sorted_set_values(weapon_data_ids),
				weaponData = weapon_data,
				attackPatternObservationRequired = true,
				evidence = {
					localizationPath = localized.path .. ":" .. weapon_id,
					runtimePaths = sorted_set_values(evidence_paths),
				},
			})
		end
		return json_array(weapons)
	end

	local function create_report(package_version, localization)
		local aspects, ids_by_weapon = collect_aspect_tables(localization)
		return {
			schema = "neodes2-weapon-runtime-1",
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
			sourceTables = json_array({ "TraitData", "WeaponData", "WeaponSets", "WeaponShopItemData" }),
			localizationFiles = json_array({ "Content/Game/Text/en/TraitText.en.sjson" }),
			weapons = collect_weapons(localization),
			aspects = aspects,
			hammers = collect_hammers(localization, ids_by_weapon),
		}
	end

	return { create_report = create_report }
end
