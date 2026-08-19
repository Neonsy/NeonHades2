return function(context)
	local game = context.game
	local json_array = context.json_array
	local json_null = context.json_null
	local sorted_keys = context.sorted_keys
	local sorted_set_values = context.sorted_set_values
	local bytewise_less = context.bytewise_less

	local MAX_DEPTH = 40
	local MAX_NODES_PER_RECORD = 100000

	local function is_presentation_field(key, value)
		if type(key) ~= "string" then return false end
		return string.find(key, "VoiceLines", 1, true) ~= nil
			or string.find(key, "Animation", 1, true) ~= nil
			or string.find(key, "Sound", 1, true) ~= nil
			or string.find(key, "Portrait", 1, true) ~= nil
			or string.find(key, "Subtitle", 1, true) ~= nil
			or string.find(key, "Camera", 1, true) ~= nil
			or string.find(key, "Vfx", 1, true) ~= nil
			or string.find(key, "Fx", 1, true) ~= nil
			or string.find(key, "Color", 1, true) ~= nil
			or key == "Icon"
			or key == "Texture"
			or key == "Font"
			or key == "Cue"
			or (key == "Text" and type(value) == "string"
				and string.match(value, "^[%a_][%w_%.:%-]*$") == nil)
	end

	local function filtered_copy(value, path, state, depth)
		local value_type = type(value)
		if value_type == "string" or value_type == "boolean" then return value end
		if value_type == "number" then
			if value ~= value or value == math.huge or value == -math.huge then
				table.insert(state.omissions, path .. ":non-finite-number")
				return json_null
			end
			return value
		end
		if value_type == "nil" then return json_null end
		if value_type ~= "table" then
			table.insert(state.omissions, path .. ":unsupported-" .. value_type)
			return json_null
		end
		if depth > MAX_DEPTH then
			table.insert(state.omissions, path .. ":depth-limit")
			return json_null
		end
		if state.ancestors[value] then
			table.insert(state.omissions, path .. ":cycle")
			return json_null
		end
		state.nodes = state.nodes + 1
		if state.nodes > MAX_NODES_PER_RECORD then
			error(path .. " exceeds the maximum guide record size")
		end
		state.ancestors[value] = true

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
				result[index] = filtered_copy(value[index], path .. "[" .. index .. "]", state, depth + 1)
			end
		else
			for _, key in ipairs(sorted_keys(value)) do
				local object_key = tostring(key)
				if not is_presentation_field(object_key, value[key])
					and object_key ~= "OriginalData"
					and object_key ~= "GeneratedData"
					and object_key ~= "LookupData"
					and object_key ~= "Dictionary" then
					result[object_key] = filtered_copy(
						value[key],
						path .. "." .. object_key,
						state,
						depth + 1
					)
				end
			end
		end
		state.ancestors[value] = nil
		return result
	end

	local function copy_record(value, path)
		local state = { ancestors = {}, nodes = 0, omissions = {} }
		local copied = filtered_copy(value, path, state, 0)
		table.sort(state.omissions, bytewise_less)
		return copied, json_array(state.omissions)
	end

	local function localized_for(id, data, localization)
		local candidates = { id }
		for _, field in ipairs({ "Name", "Text", "FlavorText", "Description" }) do
			if type(data) == "table" and type(data[field]) == "string" then
				table.insert(candidates, data[field])
			end
		end
		for _, candidate in ipairs(candidates) do
			local localized = localization[candidate]
			if localized and (localized.display_name or localized.description) then
				return localized, candidate
			end
		end
		return nil, nil
	end

	local function record(id, data, runtime_path, localization, additions)
		local copied, omissions = copy_record(data, runtime_path)
		local localized, text_id = localized_for(id, data, localization)
		local result = {
			id = id,
			displayName = localized and localized.display_name or json_null,
			description = localized and localized.description or json_null,
			data = copied,
			omissions = omissions,
			evidence = {
				runtimePath = runtime_path,
				localizationPath = localized and (localized.path .. ":" .. text_id) or json_null,
			},
		}
		for key, value in pairs(additions or {}) do result[key] = value end
		return result
	end

	local function collect_ordered_records(data, order, runtime_path, localization, classify)
		local output = {}
		local seen = {}
		for index, id in ipairs(order or {}) do
			if type(id) ~= "string" or seen[id] then error(runtime_path .. " order contains an invalid identifier") end
			seen[id] = true
			local value = data and data[id]
			if type(value) ~= "table" then error(runtime_path .. "." .. id .. " is missing") end
			if value.DebugOnly == true then error(runtime_path .. " order references a debug-only record " .. id) end
			table.insert(output, record(id, value, runtime_path .. "." .. id, localization, {
				order = index,
				classification = classify and classify(id, value) or json_null,
			}))
		end
		return json_array(output)
	end

	local function collect_all_records(data, runtime_path, localization, classify)
		local output = {}
		for _, id in ipairs(sorted_keys(data or {})) do
			local value = data[id]
			if type(id) == "string" and type(value) == "table" and value.DebugOnly ~= true then
				table.insert(output, record(id, value, runtime_path .. "." .. id, localization, {
					classification = classify and classify(id, value) or json_null,
				}))
			end
		end
		return json_array(output)
	end

	local function collect_references(value, candidates, output, ancestors, depth)
		if type(value) ~= "table" or depth > MAX_DEPTH or ancestors[value] then return end
		ancestors[value] = true
		for key, child in pairs(value) do
			if type(child) == "string" and candidates[child] then output[child] = true end
			if type(key) == "string" and candidates[key] and child then output[key] = true end
			if type(child) == "table" then collect_references(child, candidates, output, ancestors, depth + 1) end
		end
		ancestors[value] = nil
	end

	local function candidate_set(data)
		local result = {}
		for id, value in pairs(data or {}) do
			if type(id) == "string" and type(value) == "table" and value.DebugOnly ~= true then result[id] = true end
		end
		return result
	end

	local function references(value, candidates)
		local result = {}
		collect_references(value, candidates, result, {}, 0)
		return sorted_set_values(result)
	end

	local function region_name(region_id, localization)
		local text_ids = {
			C = "BiomeC",
			Chaos = "BiomeChaos",
			Anomaly = "BiomeAnomaly",
			Dream = "BiomeDream",
			Home = "Location_Home",
		}
		local text_id = text_ids[region_id] or ("Biome" .. region_id)
		local localized = localization[text_id]
		return localized and localized.display_name or region_id,
			localized and (localized.path .. ":" .. text_id) or json_null
	end

	local function collect_regions(localization)
		local routes = {
			{ id = "underworld", regionIds = json_array({ "F", "G", "H", "I" }) },
			{ id = "surface", regionIds = json_array({ "N", "O", "P", "Q" }) },
		}
		local route_by_region = {}
		for _, route in ipairs(routes) do
			for index, id in ipairs(route.regionIds) do
				route_by_region[id] = { routeId = route.id, routeOrder = index }
			end
		end
		local region_ids = {}
		local active_room_ids = {}
		for room_id, value in pairs(game.RoomData or {}) do
			if type(room_id) == "string" and type(value) == "table" and value.DebugOnly ~= true then
				active_room_ids[room_id] = true
			end
		end
		for room_id, value in pairs(game.HubRoomData or {}) do
			if type(room_id) == "string" and type(value) == "table" and value.DebugOnly ~= true then
				active_room_ids[room_id] = true
			end
		end
		for id, rooms in pairs(game.RoomSets or {}) do
			if type(id) == "string" and type(rooms) == "table" and id ~= "Test" then region_ids[id] = true end
		end
		for _, id in ipairs({ "Home", "Chaos", "Anomaly", "Dream" }) do region_ids[id] = true end
		local regions = {}
		for _, id in ipairs(sorted_keys(region_ids)) do
			local name, localization_path = region_name(id, localization)
			local room_ids = {}
			if id == "Home" then
				for room_id, value in pairs(game.HubRoomData or {}) do
					if type(room_id) == "string" and type(value) == "table" and value.DebugOnly ~= true then room_ids[room_id] = true end
				end
			else
				for _, room_id in ipairs((game.RoomSets or {})[id] or {}) do
					if type(room_id) == "string" and active_room_ids[room_id] then room_ids[room_id] = true end
				end
			end
			local route = route_by_region[id]
			table.insert(regions, {
				id = id,
				displayName = name,
				routeId = route and route.routeId or json_null,
				routeOrder = route and route.routeOrder or json_null,
				roomIds = sorted_set_values(room_ids),
				evidence = {
					runtimePath = id == "Home" and "HubRoomData" or ("RoomSets." .. id),
					localizationPath = localization_path,
				},
			})
		end
		return json_array(routes), json_array(regions)
	end

	local function room_region_id(id, value)
		if type(value.RoomSetName) == "string" then
			return value.RoomSetName == "N_SubRooms" and "N" or value.RoomSetName
		end
		for region_id, room_ids in pairs(game.RoomSets or {}) do
			for _, room_id in ipairs(room_ids) do
				if room_id == id then return region_id == "N_SubRooms" and "N" or region_id end
			end
		end
		return "Home"
	end

	local function collect_world(localization)
		local encounter_candidates = candidate_set(game.EncounterData)
		local enemy_candidates = candidate_set(game.EnemyData)
		local reward_candidates = candidate_set(game.RewardData)
		for id in pairs(candidate_set(game.ConsumableData)) do reward_candidates[id] = true end
		for id in pairs(candidate_set(game.ResourceData)) do reward_candidates[id] = true end

		local rooms = {}
		local encounter_regions = {}
		local function add_rooms(data, runtime_path)
			for _, id in ipairs(sorted_keys(data or {})) do
				local value = data[id]
				if type(id) == "string" and type(value) == "table" and value.DebugOnly ~= true then
					local region_id = runtime_path == "HubRoomData" and "Home" or room_region_id(id, value)
					local encounter_ids = references(value, encounter_candidates)
					for _, encounter_id in ipairs(encounter_ids) do
						encounter_regions[encounter_id] = encounter_regions[encounter_id] or {}
						encounter_regions[encounter_id][region_id] = true
					end
					table.insert(rooms, record(id, value, runtime_path .. "." .. id, localization, {
						regionId = region_id,
						encounterIds = encounter_ids,
						rewardIds = references(value, reward_candidates),
					}))
				end
			end
		end
		add_rooms(game.RoomData, "RoomData")
		add_rooms(game.HubRoomData, "HubRoomData")
		table.sort(rooms, function(left, right) return bytewise_less(left.id, right.id) end)

		local encounter_enemy_ids = {}
		local encounters = {}
		for _, id in ipairs(sorted_keys(game.EncounterData or {})) do
			local value = game.EncounterData[id]
			if type(id) == "string" and type(value) == "table" and value.DebugOnly ~= true then
				local enemy_ids = references(value, enemy_candidates)
				encounter_enemy_ids[id] = enemy_ids
				local encounter_type = value.EncounterType or "Default"
				local classification = encounter_type == "Boss" and "guardian"
					or encounter_type == "Miniboss" and "miniboss"
					or string.lower(tostring(encounter_type))
				table.insert(encounters, record(id, value, "EncounterData." .. id, localization, {
					classification = classification,
					regionIds = sorted_set_values(encounter_regions[id] or {}),
					enemyIds = enemy_ids,
					rewardIds = references(value, reward_candidates),
				}))
			end
		end

		local enemy_roles = {}
		local enemy_regions = {}
		for encounter_id, enemy_ids in pairs(encounter_enemy_ids) do
			local encounter = game.EncounterData[encounter_id]
			local encounter_type = encounter and encounter.EncounterType or "Default"
			local role = encounter_type == "Boss" and "guardian"
				or encounter_type == "Miniboss" and "miniboss"
				or "normal"
			for _, enemy_id in ipairs(enemy_ids) do
				enemy_roles[enemy_id] = enemy_roles[enemy_id] or {}
				enemy_roles[enemy_id][role] = true
				enemy_regions[enemy_id] = enemy_regions[enemy_id] or {}
				for region_id in pairs(encounter_regions[encounter_id] or {}) do enemy_regions[enemy_id][region_id] = true end
			end
		end
		local enemies = {}
		for _, id in ipairs(sorted_keys(game.EnemyData or {})) do
			local value = game.EnemyData[id]
			if type(id) == "string" and type(value) == "table" and value.DebugOnly ~= true then
				local roles = enemy_roles[id] or { normal = true }
				table.insert(enemies, record(id, value, "EnemyData." .. id, localization, {
					classifications = sorted_set_values(roles),
					regionIds = sorted_set_values(enemy_regions[id] or {}),
				}))
			end
		end
		return json_array(rooms), json_array(encounters), json_array(enemies)
	end

	local function classify_bounty(_, value)
		if value.IsPackagedBounty == true or value.Category == "PackagedBounty" then return "package" end
		if value.Category == "Shrine" or value.ShrinePoints ~= nil then return "testament" end
		return "bounty"
	end

	local function classify_narrative(id)
		if string.find(id, "TrueEnding", 1, true) then return "true-ending" end
		if string.find(id, "Post", 1, true) or string.find(id, "Epilogue", 1, true) then return "postgame" end
		if string.find(id, "RunClear", 1, true) or string.find(id, "Boss", 1, true) then return "route-clear" end
		return "story"
	end

	local function classify_outro(id)
		if string.find(id, "PostTrueEnding", 1, true) then return "postgame" end
		if string.find(id, "StoryReset", 1, true) then return "story-reset" end
		if string.find(id, "EarlyEnd", 1, true) then return "route-clear" end
		return "outro"
	end

	local function collect_outro_priorities()
		local output = {}
		local seen = {}
		for index, entry in ipairs(game.GameOutroPriorities or {}) do
			if type(entry) == "string" then
				if seen[entry] then error("GameOutroPriorities repeats " .. entry) end
				seen[entry] = true
				output[index] = entry
			elseif type(entry) == "table" then
				local group = {}
				for group_index, id in ipairs(entry) do
					if type(id) ~= "string" or id == "" or seen[id] then
						error("GameOutroPriorities contains an invalid grouped identifier")
					end
					seen[id] = true
					group[group_index] = id
				end
				if #group == 0 then error("GameOutroPriorities contains an empty group") end
				output[index] = json_array(group)
			else
				error("GameOutroPriorities contains an unsupported entry")
			end
		end
		if #output == 0 then error("GameOutroPriorities is empty") end
		return json_array(output)
	end

	local function collect_relationships(localization)
		local output = {}
		for _, id in ipairs(sorted_keys(game.GiftData or {})) do
			local value = game.GiftData[id]
			if id ~= "DefaultGiftData" and type(id) == "string" and type(value) == "table"
				and value.DebugOnly ~= true then
				local relationship = record(id, value, "GiftData." .. id, localization)
				local loot = game.LootData and game.LootData[id]
				if relationship.displayName == json_null and type(loot) == "table"
					and type(loot.SpeakerName) == "string" and loot.SpeakerName ~= "" then
					relationship.displayName = loot.SpeakerName
					relationship.evidence.localizationPath = "runtime:LootData." .. id .. ".SpeakerName"
				end
				table.insert(output, relationship)
			end
		end
		return json_array(output)
	end

	local function collect_elemental_traits(localization)
		local output = {}
		for _, id in ipairs(sorted_keys(game.TraitData or {})) do
			local value = game.TraitData[id]
			if type(id) == "string" and type(value) == "table" and value.DebugOnly ~= true
				and (value.IsElementalTrait == true or value.BaseElement ~= nil or value.ElementalMultipliers ~= nil) then
				table.insert(output, record(id, value, "TraitData." .. id, localization, { classification = "element-or-infusion" }))
			end
		end
		return json_array(output)
	end

	local function create_report(package_version, localization)
		local routes, regions = collect_regions(localization)
		local rooms, encounters, enemies = collect_world(localization)
		local shrine_order = game.ShrineUpgradeOrder or {}
		local bounty_order = game.ScreenData and game.ScreenData.Shrine and game.ScreenData.Shrine.BountyOrder or {}
		return {
			schema = "neodes2-guide-runtime-1",
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
			routes = routes,
			regions = regions,
			rooms = rooms,
			encounters = encounters,
			enemies = enemies,
			rewards = collect_all_records(game.RewardData, "RewardData", localization),
			consumables = collect_all_records(game.ConsumableData, "ConsumableData", localization),
			resources = collect_all_records(game.ResourceData, "ResourceData", localization),
			statusEffects = collect_all_records(game.EffectData, "EffectData", localization, function() return "effect" end),
			elementalTraits = collect_elemental_traits(localization),
			oathConditions = collect_ordered_records(game.MetaUpgradeData, shrine_order, "MetaUpgradeData", localization),
			bounties = collect_all_records(game.BountyData, "BountyData", localization, classify_bounty),
			bountyOrder = json_array(bounty_order),
			relationships = collect_relationships(localization),
			prophecies = collect_ordered_records(game.QuestData, game.QuestOrderData or {}, "QuestData", localization),
			narrative = collect_all_records(game.NarrativeData, "NarrativeData", localization, classify_narrative),
			outros = collect_all_records(game.GameOutroData, "GameOutroData", localization, classify_outro),
			outroPriorities = collect_outro_priorities(),
			achievements = collect_all_records(game.AchievementData, "AchievementData", localization),
			namedRequirements = collect_all_records(
				game.NamedRequirementsData,
				"NamedRequirementsData",
				localization
			),
			runClearMessages = collect_all_records(
				game.GameData and game.GameData.RunClearMessageData,
				"GameData.RunClearMessageData",
				localization
			),
			sourceTables = json_array({
				"AchievementData", "BountyData", "ConsumableData", "EffectData", "EncounterData",
				"EnemyData", "GameData.RunClearMessageData", "GameOutroData", "GameOutroPriorities", "GiftData",
				"HubRoomData", "LootData",
				"MetaUpgradeData", "NamedRequirementsData", "NarrativeData", "QuestData", "QuestOrderData",
				"ResourceData", "RewardData", "RoomData", "RoomSets", "ScreenData.Shrine.BountyOrder",
				"ShrineUpgradeOrder", "TraitData",
			}),
		}
	end

	return { create_report = create_report }
end
