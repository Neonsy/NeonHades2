---@meta _
---@diagnostic disable

local EXPORTER_VERSION = "0.8.0"
local MAX_COPY_DEPTH = 32
local MAX_COPY_NODES = 250000

local envy = rom.mods["SGG_Modding-ENVY"]
envy.auto()

local modutil = rom.mods["SGG_Modding-ModUtil"]
local sjson = rom.mods["SGG_Modding-SJSON"]
local game = rom.game
local config = import "config.lua"
local create_arcana_exporter = import "arcana.lua"
local create_evidence_exporter = import "evidence.lua"
local create_guide_exporter = import "guide.lua"
local create_loadout_exporter = import "loadouts.lua"
local create_weapon_exporter = import "weapons.lua"

local bits = bit32
if not bits and type(require) == "function" then
	local loaded, library = pcall(require, "bit")
	if loaded then
		bits = library
	end
end
if not bits then
	error("NeonHades2 boon exporter requires bit32 or the LuaJIT bit library")
end

local band = bits.band
local bor = bits.bor
local bxor = bits.bxor
local bnot = bits.bnot
local lshift = bits.lshift
local rshift = bits.rshift
local unpack_values = table.unpack or unpack

local ARRAY_META = { __neodes2_json_array = true }
local JSON_NULL = setmetatable({}, { __neodes2_json_null = true })

local LOCALIZATION_FILES = {
	"Text/en/TraitText.en.sjson",
	"Text/en/HelpText.en.sjson",
	"Text/en/_FamiliarData.en.sjson",
	"Text/en/_KeepsakeData.en.sjson",
	"Text/en/_TraitData_Keepsake.en.sjson",
	"Text/en/_TraitData_Spell.en.sjson",
	"Text/en/_WorldUpgradeData.en.sjson",
	"Text/en/CodexText.en.sjson",
	"Text/en/_BountyData.en.sjson",
	"Text/en/_EncounterData.en.sjson",
	"Text/en/_EncounterData_Boss.en.sjson",
	"Text/en/_NPCData.en.sjson",
	"Text/en/_QuestData.en.sjson",
	"Text/en/_ResourceData.en.sjson",
	"Text/en/_RewardData.en.sjson",
	"Text/en/_RoomData.en.sjson",
	"Text/en/_RoomDataC.en.sjson",
	"Text/en/_RoomDataChaos.en.sjson",
	"Text/en/_RoomDataDream.en.sjson",
	"Text/en/_RoomDataF.en.sjson",
	"Text/en/_RoomDataG.en.sjson",
	"Text/en/_RoomDataH.en.sjson",
	"Text/en/_RoomDataI.en.sjson",
	"Text/en/_RoomDataN.en.sjson",
	"Text/en/_RoomDataO.en.sjson",
	"Text/en/_RoomDataP.en.sjson",
	"Text/en/_RoomDataQ.en.sjson",
	"Text/en/_ShrineData.en.sjson",
	"Text/en/_LootData.en.sjson",
	"Text/en/_LootData_Aphrodite.en.sjson",
	"Text/en/_LootData_Apollo.en.sjson",
	"Text/en/_LootData_Ares.en.sjson",
	"Text/en/_LootData_Chaos.en.sjson",
	"Text/en/_LootData_Demeter.en.sjson",
	"Text/en/_LootData_Hephaestus.en.sjson",
	"Text/en/_LootData_Hera.en.sjson",
	"Text/en/_LootData_Hermes.en.sjson",
	"Text/en/_LootData_Hestia.en.sjson",
	"Text/en/_LootData_Poseidon.en.sjson",
	"Text/en/_LootData_Selene.en.sjson",
	"Text/en/_LootData_Zeus.en.sjson",
}

local MECHANICS_FIELDS = {
	"ActivationRequirements",
	"AddAllElements",
	"BaseElement",
	"BlockInRunRarify",
	"BlockStacking",
	"CustomRarityLevels",
	"CustomRarityName",
	"ExtractValues",
	"GameStateRequirements",
	"IsDuoBoon",
	"IsElementalTrait",
	"Legendary",
	"Slot",
	"StatLines",
	"TrayStatLines",
}

local MECHANICS_ARRAY_FIELDS = {
	ExtractValues = true,
	PropertyChanges = true,
	StatLines = true,
	TrayStatLines = true,
}

local ELEMENT_INHERITANCE = {
	AirBoon = "Air",
	AetherBoon = "Aether",
	EarthBoon = "Earth",
	FireBoon = "Fire",
	WaterBoon = "Water",
}

local function json_array(values)
	return setmetatable(values or {}, ARRAY_META)
end

local function bytewise_less(left, right)
	local left_string = tostring(left)
	local right_string = tostring(right)
	local shared_length = math.min(#left_string, #right_string)
	for index = 1, shared_length do
		local left_byte = string.byte(left_string, index)
		local right_byte = string.byte(right_string, index)
		if left_byte ~= right_byte then
			return left_byte < right_byte
		end
	end
	return #left_string < #right_string
end

local function sorted_keys(value)
	local keys = {}
	for key in pairs(value) do
		table.insert(keys, key)
	end
	table.sort(keys, bytewise_less)
	return keys
end

local function sorted_set_values(values)
	local result = {}
	for value, present in pairs(values) do
		if present then
			table.insert(result, value)
		end
	end
	table.sort(result, bytewise_less)
	return json_array(result)
end

local function table_shape(value, path)
	local numeric_count = 0
	local string_count = 0
	local maximum = 0
	for key in pairs(value) do
		if type(key) == "number" and key == key and key ~= math.huge and key ~= -math.huge then
			numeric_count = numeric_count + 1
			if key > 0 and key % 1 == 0 then
				maximum = math.max(maximum, key)
			end
		elseif type(key) == "string" then
			string_count = string_count + 1
		else
			error(path .. " contains an unsupported table key of type " .. type(key))
		end
	end
	if numeric_count > 0 and string_count == 0 and maximum == numeric_count then
		return "array"
	end
	return "object"
end

local function json_object_key(key, path)
	if type(key) == "string" then
		return key
	end
	if type(key) == "number" and key == key and key ~= math.huge and key ~= -math.huge then
		return tostring(key)
	end
	error(path .. " contains an unsupported JSON object key of type " .. type(key))
end

local function copy_value(value, path, state, depth)
	local value_type = type(value)
	if value_type == "string" or value_type == "boolean" then
		return value
	end
	if value_type == "number" then
		if value ~= value or value == math.huge or value == -math.huge then
			error(path .. " contains a non-finite number")
		end
		return value
	end
	if value_type ~= "table" then
		error(path .. " contains an unsupported " .. value_type .. " value")
	end
	if depth > MAX_COPY_DEPTH then
		error(path .. " exceeds the maximum export depth")
	end
	if state.ancestors[value] then
		error(path .. " contains a cycle")
	end
	state.nodes = state.nodes + 1
	if state.nodes > MAX_COPY_NODES then
		error(path .. " exceeds the maximum export size")
	end

	state.ancestors[value] = true
	local shape = table_shape(value, path)
	local result
	if shape == "array" then
		result = json_array({})
		for index = 1, #value do
			result[index] = copy_value(value[index], path .. "[" .. index .. "]", state, depth + 1)
		end
	else
		result = {}
		for _, key in ipairs(sorted_keys(value)) do
			local object_key = json_object_key(key, path)
			if result[object_key] ~= nil then
				error(path .. " has colliding JSON object key " .. object_key)
			end
			result[object_key] = copy_value(value[key], path .. "." .. object_key, state, depth + 1)
		end
	end
	state.ancestors[value] = nil
	return result
end

local function safe_copy(value, path)
	return copy_value(value, path, { ancestors = {}, nodes = 0 }, 0)
end

local function json_escape(value)
	local result = { '"' }
	for index = 1, #value do
		local byte = string.byte(value, index)
		if byte == 34 then
			table.insert(result, '\\"')
		elseif byte == 92 then
			table.insert(result, "\\\\")
		elseif byte == 8 then
			table.insert(result, "\\b")
		elseif byte == 9 then
			table.insert(result, "\\t")
		elseif byte == 10 then
			table.insert(result, "\\n")
		elseif byte == 12 then
			table.insert(result, "\\f")
		elseif byte == 13 then
			table.insert(result, "\\r")
		elseif byte < 32 then
			table.insert(result, string.format("\\u%04x", byte))
		else
			table.insert(result, string.char(byte))
		end
	end
	table.insert(result, '"')
	return table.concat(result)
end

local function encode_json(value, path, ancestors)
	local value_type = type(value)
	if value_type == "string" then
		return json_escape(value)
	end
	if value_type == "boolean" or value_type == "number" then
		return tostring(value)
	end
	if value_type ~= "table" then
		error(path .. " cannot be encoded as JSON")
	end
	local meta = getmetatable(value)
	if meta and meta.__neodes2_json_null then
		return "null"
	end
	if ancestors[value] then
		error(path .. " contains a cycle during JSON encoding")
	end
	ancestors[value] = true
	local shape = meta and meta.__neodes2_json_array and "array" or table_shape(value, path)
	local parts = {}
	if shape == "array" then
		for index = 1, #value do
			table.insert(parts, encode_json(value[index], path .. "[" .. index .. "]", ancestors))
		end
		ancestors[value] = nil
		return "[" .. table.concat(parts, ",") .. "]"
	end
	local object_keys = {}
	for _, key in ipairs(sorted_keys(value)) do
		local object_key = json_object_key(key, path)
		if object_keys[object_key] then
			error(path .. " has colliding JSON object key " .. object_key)
		end
		object_keys[object_key] = true
		table.insert(parts, json_escape(object_key) .. ":" .. encode_json(value[key], path .. "." .. object_key, ancestors))
	end
	ancestors[value] = nil
	return "{" .. table.concat(parts, ",") .. "}"
end

local function to_json(value)
	return encode_json(value, "$", {}) .. "\n"
end

local SHA256_CONSTANTS = {
	0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
	0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
	0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
	0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
	0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
	0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
	0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
	0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
}

local function rotate_right(value, count)
	if bits.rrotate then
		return bits.rrotate(value, count)
	end
	if bits.ror then
		return bits.ror(value, count)
	end
	return bor(rshift(value, count), lshift(value, 32 - count))
end

local function add32(...)
	local total = 0
	for index = 1, select("#", ...) do
		total = total + select(index, ...)
	end
	return band(total, 0xffffffff)
end

local function uint32_bytes(value)
	return string.char(
		math.floor(value / 0x1000000) % 0x100,
		math.floor(value / 0x10000) % 0x100,
		math.floor(value / 0x100) % 0x100,
		value % 0x100
	)
end

local HEX_DIGITS = "0123456789abcdef"

local function uint32_hex(value)
	local parts = {}
	for shift = 28, 0, -4 do
		local digit = band(rshift(value, shift), 0xf)
		table.insert(parts, string.sub(HEX_DIGITS, digit + 1, digit + 1))
	end
	return table.concat(parts)
end

local function sha256(value)
	local bit_length = #value * 8
	local padding_length = (56 - ((#value + 1) % 64)) % 64
	local high_length = math.floor(bit_length / 0x100000000)
	local low_length = bit_length % 0x100000000
	local message = value .. "\128" .. string.rep("\0", padding_length) .. uint32_bytes(high_length) .. uint32_bytes(low_length)
	local hashes = { 0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19 }

	for offset = 1, #message, 64 do
		local words = {}
		for index = 0, 15 do
			local position = offset + index * 4
			local a, b, c, d = string.byte(message, position, position + 3)
			words[index + 1] = band(a * 0x1000000 + b * 0x10000 + c * 0x100 + d, 0xffffffff)
		end
		for index = 17, 64 do
			local previous15 = words[index - 15]
			local previous2 = words[index - 2]
			local sigma0 = bxor(rotate_right(previous15, 7), rotate_right(previous15, 18), rshift(previous15, 3))
			local sigma1 = bxor(rotate_right(previous2, 17), rotate_right(previous2, 19), rshift(previous2, 10))
			words[index] = add32(words[index - 16], sigma0, words[index - 7], sigma1)
		end

		local a, b, c, d, e, f, g, h = unpack_values(hashes)
		for index = 1, 64 do
			local sum1 = bxor(rotate_right(e, 6), rotate_right(e, 11), rotate_right(e, 25))
			local choice = bxor(band(e, f), band(bnot(e), g))
			local temporary1 = add32(h, sum1, choice, SHA256_CONSTANTS[index], words[index])
			local sum0 = bxor(rotate_right(a, 2), rotate_right(a, 13), rotate_right(a, 22))
			local majority = bxor(band(a, b), band(a, c), band(b, c))
			local temporary2 = add32(sum0, majority)
			h = g
			g = f
			f = e
			e = add32(d, temporary1)
			d = c
			c = b
			b = a
			a = add32(temporary1, temporary2)
		end
		hashes[1] = add32(hashes[1], a)
		hashes[2] = add32(hashes[2], b)
		hashes[3] = add32(hashes[3], c)
		hashes[4] = add32(hashes[4], d)
		hashes[5] = add32(hashes[5], e)
		hashes[6] = add32(hashes[6], f)
		hashes[7] = add32(hashes[7], g)
		hashes[8] = add32(hashes[8], h)
	end

	local parts = {}
	for _, value_part in ipairs(hashes) do
		table.insert(parts, uint32_hex(value_part))
	end
	return table.concat(parts)
end

local function read_file(path)
	local file, message = io.open(path, "rb")
	if not file then
		error(message or ("Unable to read " .. path))
	end
	local content = file:read("*all")
	file:close()
	return content
end

local function write_new_file(path, content)
	local existing = io.open(path, "rb")
	if existing then
		existing:close()
		error("Refusing to overwrite existing export file " .. path)
	end
	local file, message = io.open(path, "wb")
	if not file then
		error(message or ("Unable to write " .. path))
	end
	local ok, write_message = file:write(content)
	local close_ok, close_message = file:close()
	if not ok then
		error(write_message or ("Unable to write " .. path))
	end
	if close_ok == nil then
		error(close_message or ("Unable to close " .. path))
	end
end

local function finalize_file(temporary_path, final_path)
	local ok, message = os.rename(temporary_path, final_path)
	if not ok then
		error(message or ("Unable to finalize " .. final_path))
	end
end

local function validate_config()
	local required = {
		"acquisition_id",
		"executable_version",
		"package_version",
		"source_manifest_sha256",
		"steam_build_id",
	}
	if type(config) ~= "table" or config.schema ~= "neodes2-boon-export-config-1" then
		error("Missing or unsupported NeonHades2 exporter config")
	end
	for _, key in ipairs(required) do
		if type(config[key]) ~= "string" or config[key] == "" then
			error("Exporter config field " .. key .. " must be a nonempty string")
		end
	end
end

local function load_localization()
	local raw = {}
	for _, relative_path in ipairs(LOCALIZATION_FILES) do
		local decoded = sjson.decode_file(sjson.get_game_data_path(relative_path))
		if type(decoded) ~= "table" or type(decoded.Texts) ~= "table" then
			error("Localization file has no Texts array: " .. relative_path)
		end
		for _, entry in ipairs(decoded.Texts) do
			if type(entry) == "table" and type(entry.Id) == "string" then
				raw[entry.Id] = {
					display_name = type(entry.DisplayName) == "string" and entry.DisplayName or nil,
					description = type(entry.Description) == "string" and entry.Description or nil,
					inherit_from = type(entry.InheritFrom) == "string" and entry.InheritFrom or nil,
					path = "Content/Game/" .. relative_path,
				}
			end
		end
	end
	local index = {}
	local resolving = {}
	local function resolve_entry(id)
		if index[id] then return index[id] end
		if resolving[id] then error("Localization inheritance cycle at " .. id) end
		local entry = raw[id]
		if entry == nil then return nil end
		resolving[id] = true
		local parent = entry.inherit_from and resolve_entry(entry.inherit_from) or nil
		local resolved = {
			display_name = entry.display_name or (parent and parent.display_name) or nil,
			description = entry.description or (parent and parent.description) or nil,
			path = entry.path,
		}
		index[id] = resolved
		resolving[id] = nil
		return resolved
	end
	for id in pairs(raw) do resolve_entry(id) end
	return index
end

local function add_trait_list(target, values)
	if values == nil then
		return
	end
	for _, trait_id in ipairs(values) do
		if type(trait_id) ~= "string" then
			error("Loot trait list contains a non-string identifier")
		end
		target[trait_id] = true
	end
end

local function collect_loot_sources(localization)
	local loot_sources = {}
	local ownership = {}
	local supported_nonstandard_sources = {
		HermesUpgrade = true,
		TrialUpgrade = true,
	}
	for loot_id, loot_data in pairs(game.LootData) do
		if type(loot_id) == "string" and type(loot_data) == "table"
			and (loot_data.GodLoot == true or supported_nonstandard_sources[loot_id] == true) then
			local boon_set = {}
			add_trait_list(boon_set, loot_data.WeaponUpgrades)
			add_trait_list(boon_set, loot_data.Traits)
			add_trait_list(boon_set, loot_data.PermanentTraits)
			add_trait_list(boon_set, loot_data.TemporaryTraits)
			local boon_ids = sorted_set_values(boon_set)
			if #boon_ids > 0 then
				for _, boon_id in ipairs(boon_ids) do
					if type(game.TraitData[boon_id]) ~= "table" then
						error("LootData." .. loot_id .. " references missing TraitData." .. boon_id)
					end
					ownership[boon_id] = ownership[boon_id] or {}
					ownership[boon_id][loot_id] = true
				end
				local speaker_name = type(loot_data.SpeakerName) == "string" and loot_data.SpeakerName or loot_id
				local localized = localization[loot_id] or localization[speaker_name]
				table.insert(loot_sources, {
					id = loot_id,
					displayName = localized and localized.display_name or speaker_name,
					speakerName = speaker_name,
					boonIds = boon_ids,
					runtimePath = "LootData." .. loot_id,
					localizationPath = localized and localized.path or "runtime:LootData." .. loot_id .. ".SpeakerName",
				})
			end
		end
	end
	table.sort(loot_sources, function(left, right)
		return bytewise_less(left.id, right.id)
	end)
	return json_array(loot_sources), ownership
end

local function collect_trait_text_references(localization, ownership)
	local references = {}
	for boon_id in pairs(ownership) do
		local localized = localization[boon_id]
		local description = localized and localized.description
		if type(description) == "string" then
			for trait_id, field in string.gmatch(description, "%$TraitData%.([%w_]+)%.([%w_]+)") do
				if ownership[trait_id] == nil then
					error("TraitData text reference points outside the exported boon set: " .. trait_id .. "." .. field)
				end
				references[trait_id] = references[trait_id] or {}
				references[trait_id][field] = true
			end
		end
	end
	return references
end

local function contains(values, target)
	if type(values) ~= "table" then
		return false
	end
	for _, value in ipairs(values) do
		if value == target then
			return true
		end
	end
	return false
end

local function classify_boon(trait)
	if trait.IsDuoBoon == true or contains(trait.InheritFrom, "SynergyTrait") then
		return "duo"
	end
	if trait.Legendary == true or contains(trait.InheritFrom, "LegendaryTrait") then
		return "legendary"
	end
	if trait.IsElementalTrait == true or contains(trait.InheritFrom, "UnityTrait") then
		return "infusion"
	end
	return "normal"
end

local function collect_elements(trait)
	local elements = {}
	if type(trait.InheritFrom) == "table" then
		for _, inherited in ipairs(trait.InheritFrom) do
			local element = ELEMENT_INHERITANCE[inherited]
			if element then
				elements[element] = true
			end
		end
	end
	if type(trait.ElementalMultipliers) == "table" then
		for element, enabled in pairs(trait.ElementalMultipliers) do
			if type(element) == "string" and enabled then
				elements[element] = true
			end
		end
	end
	if type(trait.BaseElement) == "string" then
		elements[trait.BaseElement] = true
	end
	return sorted_set_values(elements)
end

local function collect_report_sources(value, path, output, ancestors, depth)
	if type(value) ~= "table" then
		return
	end
	if depth > MAX_COPY_DEPTH then
		error(path .. " exceeds the maximum report-source depth")
	end
	if ancestors[value] then
		error(path .. " contains a cycle while collecting report sources")
	end
	ancestors[value] = true
	if value.ReportValues ~= nil then
		table.insert(output, { path = path, data = safe_copy(value, path) })
	end
	for _, key in ipairs(sorted_keys(value)) do
		local child = value[key]
		if type(child) == "table" then
			local child_path = type(key) == "number" and (path .. "[" .. key .. "]") or (path .. "." .. key)
			collect_report_sources(child, child_path, output, ancestors, depth + 1)
		end
	end
	ancestors[value] = nil
end

local function collect_mechanics(trait, trait_id, referenced_fields)
	local mechanics = {}
	local selected_fields = {}
	for _, field in ipairs(MECHANICS_FIELDS) do
		selected_fields[field] = true
	end
	for field in pairs(referenced_fields or {}) do
		selected_fields[field] = true
	end
	for _, field in ipairs(sorted_keys(selected_fields)) do
		if trait[field] ~= nil then
			local copied = safe_copy(trait[field], "TraitData." .. trait_id .. "." .. field)
			if MECHANICS_ARRAY_FIELDS[field] and type(trait[field]) == "table" and next(trait[field]) == nil then
				copied = json_array({})
			end
			mechanics[field] = copied
		elseif referenced_fields and referenced_fields[field] then
			error("Player-visible text references missing TraitData." .. trait_id .. "." .. field)
		end
	end
	local report_sources = {}
	collect_report_sources(trait, "TraitData." .. trait_id, report_sources, {}, 0)
	table.sort(report_sources, function(left, right)
		return bytewise_less(left.path, right.path)
	end)
	mechanics.reportSources = json_array(report_sources)
	return mechanics
end

local function rarity_endpoints(rarity_data)
	if type(rarity_data) ~= "table" then
		return json_array({ { endpoint = "fixed", multiplier = 1 } })
	end
	if type(rarity_data.Multiplier) == "number" then
		return json_array({ { endpoint = "fixed", multiplier = rarity_data.Multiplier } })
	end
	if type(rarity_data.MinMultiplier) == "number" and type(rarity_data.MaxMultiplier) == "number" then
		return json_array({
			{ endpoint = "minimum", multiplier = rarity_data.MinMultiplier },
			{ endpoint = "maximum", multiplier = rarity_data.MaxMultiplier },
		})
	end
	return json_array({ { endpoint = "fixed", multiplier = 1 } })
end

local function child_path(path, key)
	if type(key) == "number" then
		return path .. "[" .. key .. "]"
	end
	return path .. "." .. key
end

local function normalize_element_context(value, elements, ancestors, depth)
	if type(value) ~= "table" then
		return
	end
	if depth > MAX_COPY_DEPTH then
		error("Trait data exceeds the maximum element-context depth")
	end
	if ancestors[value] then
		error("Trait data contains a cycle while applying the element context")
	end
	ancestors[value] = true
	if value.MultipliedByElement ~= nil then
		if type(value.MultipliedByElement) ~= "string" then
			error("MultipliedByElement must name one element")
		end
		elements[value.MultipliedByElement] = true
		value.MultipliedByElement = nil
	end
	for _, key in ipairs(sorted_keys(value)) do
		local child = value[key]
		if type(child) == "table" then
			normalize_element_context(child, elements, ancestors, depth + 1)
		end
	end
	ancestors[value] = nil
end

local function element_context_values(elements)
	local result = {}
	for _, element in ipairs(sorted_keys(elements)) do
		table.insert(result, { element = element, count = 1 })
	end
	return json_array(result)
end

local function add_reported_value(output, key, value, path, selector_value)
	local copied = safe_copy(value, path)
	local encoded = to_json(copied)
	local observations = output[key]
	if observations == nil then
		observations = {}
		output[key] = observations
	end
	table.insert(observations, {
		value = copied,
		runtimePath = path,
		encoded = encoded,
		selectorValue = selector_value,
	})
end

local function collect_reported_values(value, output, ancestors, depth, path)
	if type(value) ~= "table" then
		return
	end
	if depth > MAX_COPY_DEPTH then
		error("Processed trait exceeds the maximum report-value depth")
	end
	if ancestors[value] then
		error("Processed trait contains a cycle while resolving report values")
	end
	ancestors[value] = true
	for _, key in ipairs(sorted_keys(value)) do
		local child = value[key]
		if key ~= "ReportValues" and type(child) == "table" then
			collect_reported_values(child, output, ancestors, depth + 1, child_path(path, key))
		end
	end
	if type(value.ReportValues) == "table" then
		for _, reported_key in ipairs(sorted_keys(value.ReportValues)) do
			local source_key = value.ReportValues[reported_key]
			if type(reported_key) ~= "string" or type(source_key) ~= "string" then
				error("ReportValues contains a non-string mapping")
			end
			if value[source_key] ~= nil then
				local selector_value = type(value.WeaponName) == "string" and value.WeaponName or nil
				add_reported_value(output, reported_key, value[source_key], path .. "." .. source_key, selector_value)
			end
		end
	end
	ancestors[value] = nil
end

local function resolve_static_base_value(base_type, base_name, base_property, instruction)
	if type(base_type) ~= "string" or type(base_name) ~= "string"
		or (type(base_property) ~= "string" and type(base_property) ~= "table") then
		error("Static base-data references require a string type and name plus a property or property path")
	end
	local value
	local runtime_path
	if base_type == "Projectile" or base_type == "ProjectileBase" then
		value = game.GetBaseDataValue({ Type = "Projectile", Name = base_name, Property = base_property })
		runtime_path = "GetBaseDataValue.Projectile." .. base_name .. "." .. base_property
	elseif base_type == "Weapon" then
		value = game.GetBaseDataValue({ Type = "Weapon", Name = base_name, Property = base_property })
		runtime_path = "GetBaseDataValue.Weapon." .. base_name .. "." .. base_property
	elseif base_type == "HeroData" then
		local hero_data = game.HeroData[base_name]
		value = hero_data and hero_data[base_property]
		runtime_path = "HeroData." .. base_name .. "." .. tostring(base_property)
	elseif base_type == "ConsumableData" then
		local consumable = game.ConsumableData[base_name]
		value = consumable and consumable[base_property]
		runtime_path = "ConsumableData." .. base_name .. "." .. tostring(base_property)
	elseif base_type == "MetaUpgradeRequirement" then
		local card = game.MetaUpgradeCardData[base_name]
		local requirements = card and card.AutoEquipRequirements
		value = requirements and requirements[base_property]
		runtime_path = "MetaUpgradeCardData." .. base_name .. ".AutoEquipRequirements." .. tostring(base_property)
	elseif base_type == "WeaponData" then
		local weapon = game.WeaponData[base_name]
		if type(weapon) ~= "table" then
			error("WeaponData." .. base_name .. " was not found")
		end
		if base_property == "ManaPerSecond" and type(weapon.DrainManaEffect) == "table" then
			value = weapon.DrainManaEffect.CostPerSecond
			runtime_path = "WeaponData." .. base_name .. ".DrainManaEffect.CostPerSecond"
		elseif base_property == "ChargeStageProperty" then
			local stage = instruction and instruction.ChargeStage
			local property = instruction and instruction.ChargeStageProperty
			value = weapon.ChargeWeaponStages and weapon.ChargeWeaponStages[stage]
				and weapon.ChargeWeaponStages[stage][property]
			runtime_path = "WeaponData." .. base_name .. ".ChargeWeaponStages[" .. tostring(stage) .. "]." .. tostring(property)
		elseif base_property == "FiredFunctionArgs" then
			local property = instruction and instruction.FiredFunctionArg
			value = weapon.OnFiredFunctionArgs and weapon.OnFiredFunctionArgs[property]
			runtime_path = "WeaponData." .. base_name .. ".OnFiredFunctionArgs." .. tostring(property)
		else
			value = weapon[base_property]
			runtime_path = "WeaponData." .. base_name .. "." .. tostring(base_property)
		end
	elseif base_type == "TraitData" then
		local processed = game.GetProcessedTraitData({
			Unit = { Traits = {} },
			TraitName = base_name,
			TraitData = game.DeepCopyTable(game.TraitData[base_name]),
			StackNum = 1,
			ForceMin = true,
		})
		if type(processed) ~= "table" then
			error("TraitData." .. base_name .. " could not be processed")
		end
		local path = type(base_property) == "table" and base_property or { base_property }
		local path_parts = {}
		value = processed
		for _, key in ipairs(path) do
			value = type(value) == "table" and value[key] or nil
			table.insert(path_parts, tostring(key))
		end
		runtime_path = "TraitData." .. base_name .. ".processed." .. table.concat(path_parts, ".")
	elseif base_type == "EffectLuaData" then
		local effect = game.EffectData[base_name]
		value = effect and effect[base_property]
		runtime_path = "EffectData." .. base_name .. "." .. base_property
	elseif base_type == "EffectData" then
		local effect = game.EffectData[base_name]
		if effect and base_property == "ActiveDuration" and type(effect.EffectData) == "table" then
			local duration = effect.EffectData.Duration
			local threshold = effect.EffectData.ExpiringTimeThreshold
			if type(duration) == "number" and type(threshold) == "number" then
				value = duration - threshold
			end
			runtime_path = "EffectData." .. base_name .. ".EffectData.Duration-ExpiringTimeThreshold"
		elseif effect and type(effect.EffectData) == "table" then
			value = effect.EffectData[base_property]
			runtime_path = "EffectData." .. base_name .. ".EffectData." .. base_property
		elseif effect and type(effect.DataProperties) == "table" then
			value = effect.DataProperties[base_property]
			runtime_path = "EffectData." .. base_name .. ".DataProperties." .. base_property
		end
	else
		error("Unsupported static base-data type " .. base_type)
	end
	if value == nil then
		error("Static base-data value was not found for " .. base_type .. "." .. base_name .. "." .. base_property)
	end
	return {
		baseType = base_type,
		baseName = base_name,
		baseProperty = safe_copy(base_property, "static-base-data.baseProperty"),
		runtimePath = runtime_path,
		value = safe_copy(value, runtime_path),
	}
end

local function require_numeric(value, label)
	if type(value) ~= "number" then
		error(label .. " must resolve to a number")
	end
	return value
end

local function build_sample_resolution(raw_value, instruction, extract_as, initial_context_inputs, source_expression)
	local resolved_value = raw_value
	local expression = source_expression or "value"
	local context_inputs = {}
	local contextual = false
	local static_inputs = {}
	local initial_context_count = 0
	for input_id, enabled in pairs(initial_context_inputs or {}) do
		if enabled then
			context_inputs[input_id] = true
			contextual = true
			initial_context_count = initial_context_count + 1
		end
	end
	if initial_context_count > 1 then error("A sampled source cannot have more than one primary context value") end

	local function add_context_input(input_id)
		context_inputs[input_id] = true
		contextual = true
	end

	local function add_static_input(id, base_type, base_name, base_property)
		local input = resolve_static_base_value(base_type, base_name, base_property, instruction)
		input.id = id
		table.insert(static_inputs, input)
		return require_numeric(input.value, "Static input " .. id)
	end

	local automatic = nil
	if (instruction.External == true or instruction.CheckAutomaticPropertyChanges == true)
		and type(game.AutomaticExtractProperties) == "table" then
		automatic = game.AutomaticExtractProperties[extract_as]
	end
	if type(automatic) == "table" then
		if type(automatic.AddHeroValue) == "string" then
			add_context_input(automatic.AddHeroValue)
			expression = "(" .. expression .. " + " .. automatic.AddHeroValue .. ")"
		end
		if type(automatic.MultiplyHeroValue) == "string" then
			add_context_input(automatic.MultiplyHeroValue)
			expression = "(" .. expression .. " * " .. automatic.MultiplyHeroValue .. ")"
		end
		if type(automatic.ReplaceWithHeroValue) == "string" then
			add_context_input(automatic.ReplaceWithHeroValue)
			expression = "(" .. automatic.ReplaceWithHeroValue .. " ~= 1 and " .. automatic.ReplaceWithHeroValue .. " or " .. expression .. ")"
		end
	end

	local format = instruction.Format
	local terminal_string = format == "SlottedBoon" or format == "FinalBoss"
	if format ~= nil and not terminal_string then
		resolved_value = require_numeric(resolved_value, "Sample value " .. extract_as)
	end
	if format == nil or format == "MaxHealth" or format == "MaxMana" or format == "TotalTargets" then
		if format == "TotalTargets" and instruction.External == true
			and instruction.BaseType == "ProjectileBase" and instruction.BaseProperty == "NumJumps" then
			expression = "(" .. expression .. " + 1)"
			if not contextual then resolved_value = resolved_value + 1 end
		end
	elseif format == "MultiplyByBase" then
		local base_value = add_static_input("baseValue", instruction.BaseType, instruction.BaseName, instruction.BaseProperty)
		expression = "(" .. expression .. " * baseValue)"
		if not contextual then resolved_value = resolved_value * base_value end
	elseif format == "AddToBase" then
		local base_value = add_static_input("baseValue", instruction.BaseType, instruction.BaseName, instruction.BaseProperty)
		expression = "(" .. expression .. " + baseValue)"
		if not contextual then resolved_value = resolved_value + base_value end
	elseif format == "AdjustedBaseManaSpendCost" then
		local base_value = add_static_input("baseManaSpendCost", "WeaponData", instruction.WeaponName, "ManaSpendCost")
		expression = "(" .. expression .. " + baseManaSpendCost)"
		if not contextual then resolved_value = resolved_value + base_value end
	elseif format == "MultiplyByBaseOverTime" then
		local base_value = add_static_input("baseValue", instruction.BaseType, instruction.BaseName, instruction.BaseProperty)
		local fuse = add_static_input("baseFuseValue", instruction.BaseType, instruction.BaseName, instruction.BaseFuseProperty)
		expression = "((" .. expression .. " * baseValue) / baseFuseValue)"
		if not contextual then resolved_value = resolved_value * base_value / fuse end
	elseif format == "PercentOfBase" then
		local base_value = add_static_input("baseValue", instruction.BaseType, instruction.BaseName, instruction.BaseProperty)
		expression = "((" .. expression .. " / baseValue) * 100)"
		if not contextual then resolved_value = resolved_value / base_value * 100 end
	elseif format == "Percent" then
		expression = "(" .. expression .. " * 100)"
		if not contextual then resolved_value = resolved_value * 100 end
	elseif format == "FlatPercent" then
		expression = "abs(" .. expression .. " * 100)"
		if not contextual then resolved_value = math.abs(resolved_value * 100) end
	elseif format == "PercentDelta" then
		expression = "((" .. expression .. " - 1) * 100)"
		if not contextual then resolved_value = (resolved_value - 1) * 100 end
	elseif format == "FlatPercentDelta" then
		expression = "abs((" .. expression .. " - 1) * 100)"
		if not contextual then resolved_value = math.abs((resolved_value - 1) * 100) end
	elseif format == "NegativePercentDelta" then
		expression = "((1 - " .. expression .. ") * 100)"
		if not contextual then resolved_value = (1 - resolved_value) * 100 end
	elseif format == "PercentReciprocalDelta" then
		if not contextual and require_numeric(resolved_value, "Sample value " .. extract_as) <= 0 then
			error("PercentReciprocalDelta source must remain positive")
		end
		expression = "((1 / " .. expression .. ") * 100 - 100)"
		if not contextual then resolved_value = (1 / resolved_value) * 100 - 100 end
	elseif format == "TimesOneHundredPercent" then
		expression = "(" .. expression .. " * 10000)"
		if not contextual then resolved_value = resolved_value * 10000 end
	elseif format == "LuckModifiedPercent" then
		add_context_input("LuckMultiplier")
		expression = "min((" .. expression .. " * LuckMultiplier) * 100, 100)"
	elseif format == "SpeedModifiedDuration" then
		add_context_input("OlympianRechargeMultiplier")
		expression = "(" .. expression .. " * OlympianRechargeMultiplier)"
	elseif format == "FlatHeal" then
		add_context_input("HealingMultiplier")
		expression = "(" .. expression .. " * HealingMultiplier)"
	elseif format == "FlatHealBonusOnly" then
		add_context_input("HealingMultiplier")
		expression = "(" .. expression .. " * max(HealingMultiplier, 1))"
	elseif format == "PercentHeal" then
		add_context_input("HealingMultiplier")
		expression = "(" .. expression .. " * HealingMultiplier * 100)"
	elseif format == "MaxHealthIgnoreCap" then
		add_context_input("ExpectedMaxHealth")
		add_context_input("MaxHealthMultiplier")
		expression = "(round((ExpectedMaxHealth + " .. expression
			.. ") * MaxHealthMultiplier, 0) - round(ExpectedMaxHealth * MaxHealthMultiplier, 0))"
	elseif format == "UniqueGodPercentDelta" then
		add_context_input("UniqueGodCount")
		expression = "((" .. expression .. " - 1) * UniqueGodCount * 100)"
	elseif format == "ManaSpendCost" then
		expression = "value"
	elseif format == "DamageOverTime" or format == "DamageOverTotalDuration" then
		local fuse
		local fuse_expression
		if type(instruction.BaseValue) == "number" then
			fuse = instruction.BaseValue
			fuse_expression = tostring(fuse)
		else
			fuse = add_static_input(
				"baseFuseValue",
				instruction.WeaponName and "Weapon" or "Projectile",
				instruction.WeaponName or instruction.BaseName,
				instruction.BaseProperty
			)
			fuse_expression = "baseFuseValue"
		end
		local duration = 1
		local duration_expression = "1"
		if format == "DamageOverTotalDuration" and instruction.DurationSource then
			duration = add_static_input(
				"totalDuration",
				"WeaponData",
				instruction.DurationSource,
				instruction.DurationSourceKey
			)
			duration_expression = "totalDuration"
		end
		expression = "((" .. expression .. " / " .. fuse_expression .. ") * " .. duration_expression .. ")"
		if not contextual then resolved_value = resolved_value / fuse * duration end
	elseif format == "SlottedBoon" or format == "FinalBoss" then
		-- The game supplies this label from the current slot or route.
	elseif format == "Rarity" then
		resolved_value = "{$Keywords." .. game.GetRarityKey(resolved_value) .. "}"
		expression = "rarityKeyword(value)"
		terminal_string = true
	elseif format == "CardRarity" then
		resolved_value = "MetaRank" .. tostring(resolved_value)
		expression = "cardRarity(value)"
		terminal_string = true
	elseif format == "MultipliedMoney" then
		add_context_input("MoneyMultiplier")
		expression = "(" .. expression .. " * MoneyMultiplier)"
	elseif format == "RemainingBiomes" then
		add_context_input("EnteredBiomes")
		expression = "min((4 - EnteredBiomes), " .. expression .. ")"
	elseif format == "TotalDamageTaken" then
		expression = "TotalDamageTaken"
	elseif format == "TotalHeroTraitValuePercent" then
		expression = "(" .. expression .. " * 100)"
	elseif format == "TotalHeroTraitValue" or format == "ResourceAmount" then
		-- These values come directly from the current hero or resource state.
	else
		error("Unsupported sample format " .. tostring(format))
	end

	if instruction.MultiplyByMissingHealth then
		add_context_input("MissingHealth")
		expression = "(" .. expression .. " * MissingHealth)"
	end
	if instruction.MultiplyByOlympianBoonCount then
		add_context_input("OlympianBoonCount")
		expression = "(" .. expression .. " * OlympianBoonCount)"
	end
	if instruction.MultiplyByMissingLastStands then
		add_context_input("MissingLastStands")
		expression = "(" .. expression .. " * MissingLastStands)"
	end
	if instruction.MultiplyBySpentLastStands then
		add_context_input("LastStandsUsed")
		expression = "(" .. expression .. " * LastStandsUsed)"
	end
	if instruction.AbsoluteValue ~= nil then
		expression = "abs(" .. expression .. ")"
		if not contextual then resolved_value = math.abs(require_numeric(resolved_value, "Sample value " .. extract_as)) end
	end
	if instruction.MaximumValue ~= nil then
		local maximum = require_numeric(instruction.MaximumValue, "MaximumValue")
		expression = "min(" .. expression .. ", " .. tostring(maximum) .. ")"
		if not contextual then resolved_value = math.min(require_numeric(resolved_value, "Sample value " .. extract_as), maximum) end
	end

	local precision = instruction.DecimalPlaces or 0
	if type(precision) ~= "number" or precision < 0 or precision % 1 ~= 0 then
		error("DecimalPlaces must be a nonnegative integer")
	end
	if not terminal_string then
		expression = "round(" .. expression .. ", " .. precision .. ")"
	end
	if not contextual and not terminal_string then
		resolved_value = game.round(require_numeric(resolved_value, "Sample value " .. extract_as), precision)
	end
	table.sort(static_inputs, function(left, right)
		return bytewise_less(left.id, right.id)
	end)
	if contextual then
		return json_array(static_inputs), {
			kind = "contextual",
			expression = expression,
			inputIds = sorted_set_values(context_inputs),
		}
	end
	return json_array(static_inputs), {
		kind = "resolved",
		value = safe_copy(resolved_value, "sample.resolution." .. extract_as),
	}
end

local function build_reported_source(reported, source_key)
	local observations = reported[source_key]
	if type(observations) ~= "table" or #observations == 0 then
		error("Sample source key " .. tostring(source_key) .. " was not resolved")
	end
	local scoped_observations = {}
	local unscoped_observations = {}
	for _, observation in ipairs(observations) do
		if type(observation.selectorValue) == "string" and observation.selectorValue ~= "" then
			table.insert(scoped_observations, observation)
		else
			table.insert(unscoped_observations, observation)
		end
	end
	local unscoped_value = unscoped_observations[1] and unscoped_observations[1].encoded or nil
	local unscoped_values_match = unscoped_value ~= nil
	for index = 2, #unscoped_observations do
		if unscoped_observations[index].encoded ~= unscoped_value then
			unscoped_values_match = false
			break
		end
	end
	if unscoped_values_match then
		-- A top-level ReportValues entry is the authored tooltip value. Expanded
		-- weapon timing properties may store the same effect reciprocally.
		observations = unscoped_observations
	elseif #scoped_observations > 0 then
		observations = scoped_observations
	end
	table.sort(observations, function(left, right)
		return bytewise_less(left.runtimePath, right.runtimePath)
	end)
	local first = observations[1]
	local one_value = true
	for index = 2, #observations do
		if observations[index].encoded ~= first.encoded then
			one_value = false
			break
		end
	end
	if one_value then
		return {
			kind = "processed-trait",
			key = source_key,
			runtimePath = first.runtimePath,
			value = first.value,
		}, first.value, {}, "value"
	end

	local variants_by_selector = {}
	for _, observation in ipairs(observations) do
		if type(observation.selectorValue) ~= "string" or observation.selectorValue == "" then
			error("Conflicting sample source " .. source_key .. " has no WeaponName selector")
		end
		local variant = variants_by_selector[observation.selectorValue]
		if variant == nil then
			variant = {
				selectorValue = observation.selectorValue,
				runtimePaths = {},
				value = observation.value,
				encoded = observation.encoded,
			}
			variants_by_selector[observation.selectorValue] = variant
		elseif variant.encoded ~= observation.encoded then
			error("Conflicting sample source " .. source_key .. " has multiple values for " .. observation.selectorValue)
		end
		table.insert(variant.runtimePaths, observation.runtimePath)
	end

	local variants = {}
	for _, selector_value in ipairs(sorted_keys(variants_by_selector)) do
		local variant = variants_by_selector[selector_value]
		table.sort(variant.runtimePaths, bytewise_less)
		table.insert(variants, {
			selectorValue = variant.selectorValue,
			runtimePaths = json_array(variant.runtimePaths),
			value = variant.value,
		})
	end
	if #variants < 2 then
		error("Conflicting sample source " .. source_key .. " has no distinct WeaponName choices")
	end
	return {
		kind = "processed-trait-variants",
		key = source_key,
		selectorInputId = "WeaponName",
		variants = json_array(variants),
	}, variants[1].value, { WeaponName = true }, "value"
end

local function extract_sample_values(processed, trait_id)
	local extract_values = processed.ExtractValues
	if type(extract_values) ~= "table" then
		return json_array({})
	end
	local processed_path = "TraitData." .. trait_id .. ".processed"
	local reported = {}
	collect_reported_values(processed, reported, {}, 0, processed_path)
	for _, key in ipairs(sorted_keys(processed)) do
		local value = processed[key]
		local value_type = type(value)
		if reported[key] == nil and type(key) == "string"
			and (value_type == "string" or value_type == "boolean" or value_type == "number") then
			add_reported_value(reported, key, value, processed_path .. "." .. key, nil)
		end
	end

	local instructions_by_id = {}
	for index, instruction in ipairs(extract_values) do
		if type(instruction) ~= "table" then
			error("TraitData." .. trait_id .. ".ExtractValues[" .. index .. "] is not a table")
		end
		local extract_as = instruction.ExtractAs
		if type(extract_as) ~= "string" or extract_as == "" then
			error("ExtractValues instruction has no stable ExtractAs id")
		end
		-- ExtractValue writes sequentially, so the final instruction owns a repeated key.
		instructions_by_id[extract_as] = instruction
	end

	local entries_by_id = {}
	local resolving = {}
	local function combine_resolution(resolution, operand, operator, extract_as, operand_id)
		if resolution.kind == "resolved" and operand.kind == "resolved" then
			local left = require_numeric(resolution.value, "Sample value " .. extract_as)
			local right = require_numeric(operand.value, "Sample value " .. operand_id)
			return {
				kind = "resolved",
				value = operator == "-" and (left - right) or (left * right),
			}
		end
		local inputs = {}
		for _, input_id in ipairs(resolution.inputIds or {}) do inputs[input_id] = true end
		for _, input_id in ipairs(operand.inputIds or {}) do inputs[input_id] = true end
		local left_expression = resolution.kind == "resolved" and tostring(resolution.value) or resolution.expression
		local right_expression = operand.kind == "resolved" and tostring(operand.value) or operand.expression
		return {
			kind = "contextual",
			expression = "(" .. left_expression .. " " .. operator .. " " .. right_expression .. ")",
			inputIds = sorted_set_values(inputs),
		}
	end

	local resolve_entry
	resolve_entry = function(extract_as)
		if entries_by_id[extract_as] then return entries_by_id[extract_as] end
		if resolving[extract_as] then error("ExtractValues contains a cross-value cycle at " .. extract_as) end
		local instruction = instructions_by_id[extract_as]
		if type(instruction) ~= "table" then error("ExtractValues references missing " .. tostring(extract_as)) end
		resolving[extract_as] = true

		local source
		local raw_value
		local source_context_inputs = {}
		local source_expression = "value"
		if instruction.Format == "SlottedBoon" then
			if type(instruction.Slot) ~= "string" or instruction.Slot == "" then
				error("SlottedBoon sample has no slot")
			end
			local input_id = "Slotted" .. instruction.Slot .. "Boon"
			raw_value = "Blank"
			source = { kind = "context-value", inputId = input_id }
			source_context_inputs[input_id] = true
			source_expression = input_id
		elseif instruction.Format == "ManaSpendCost" then
			local static = resolve_static_base_value(
				"WeaponData",
				instruction.WeaponName,
				"ManaSpendCost",
				instruction
			)
			raw_value = static.value
			source = {
				kind = "static-base-data",
				baseType = static.baseType,
				baseName = static.baseName,
				baseProperty = static.baseProperty,
				runtimePath = static.runtimePath,
				value = static.value,
			}
		elseif instruction.Format == "TotalDamageTaken" then
			raw_value = 0
			source = { kind = "context-value", inputId = "TotalDamageTaken" }
			source_context_inputs.TotalDamageTaken = true
			source_expression = "TotalDamageTaken"
		elseif instruction.Format == "TotalHeroTraitValuePercent" or instruction.Format == "TotalHeroTraitValue" then
			local input_id = "HeroTraitValue:" .. tostring(instruction.Key)
			raw_value = 0
			source = { kind = "context-value", inputId = input_id }
			source_context_inputs[input_id] = true
			source_expression = input_id
		elseif instruction.Format == "ResourceAmount" then
			local input_id = "ResourceAmount:" .. tostring(instruction.Key)
			raw_value = 0
			source = { kind = "context-value", inputId = input_id }
			source_context_inputs[input_id] = true
			source_expression = input_id
		elseif instruction.Format == "FinalBoss" then
			local input_id = "FinalBoss"
			raw_value = "Blank"
			source = { kind = "context-value", inputId = input_id }
			source_context_inputs[input_id] = true
			source_expression = input_id
		elseif instruction.External == true then
			local static = resolve_static_base_value(
				instruction.BaseType,
				instruction.BaseName,
				instruction.BaseProperty,
				instruction
			)
			raw_value = static.value
			source = {
				kind = "static-base-data",
				baseType = static.baseType,
				baseName = static.baseName,
				baseProperty = static.baseProperty,
				runtimePath = static.runtimePath,
				value = static.value,
			}
		else
			local source_key = instruction.Key or "ChangeValue"
			if type(source_key) ~= "string" then
				error("Sample source key must be a string")
			end
			source, raw_value, source_context_inputs, source_expression = build_reported_source(reported, source_key)
		end
		local static_inputs, resolution = build_sample_resolution(
			raw_value,
			instruction,
			extract_as,
			source_context_inputs,
			source_expression
		)
		if instruction.Subtractor then
			resolution = combine_resolution(
				resolution,
				resolve_entry(instruction.Subtractor).resolution,
				"-",
				extract_as,
				instruction.Subtractor
			)
		end
		if instruction.Multiplier then
			resolution = combine_resolution(
				resolution,
				resolve_entry(instruction.Multiplier).resolution,
				"*",
				extract_as,
				instruction.Multiplier
			)
		end
		if instruction.Negative then
			if resolution.kind == "resolved" then
				resolution.value = -require_numeric(resolution.value, "Sample value " .. extract_as)
			else
				resolution.expression = "-(" .. resolution.expression .. ")"
			end
		end
		local entry = {
			id = extract_as,
			source = source,
			staticInputs = static_inputs,
			resolution = resolution,
		}
		entries_by_id[extract_as] = entry
		resolving[extract_as] = nil
		return entry
	end

	local values = {}
	for _, extract_as in ipairs(sorted_keys(instructions_by_id)) do
		table.insert(values, resolve_entry(extract_as))
	end
	return json_array(values)
end

local function sample_trait(trait_id, trait, rarity, endpoint, multiplier, level)
	local context = { mode = "player-independent", elementCounts = json_array({}) }
	local ok, result = pcall(function()
		local source = game.DeepCopyTable(trait)
		local elements = {}
		normalize_element_context(source, elements, {}, 0)
		context.elementCounts = element_context_values(elements)
		source.Rarity = rarity
		source.RarityMultiplier = multiplier
		local processed = game.GetProcessedTraitData({
			Unit = { Traits = {} },
			TraitName = trait_id,
			TraitData = source,
			Rarity = rarity,
			RarityMultiplier = multiplier,
			StackNum = level,
			ForceMin = true,
		})
		if type(processed) ~= "table" then
			error("GetProcessedTraitData returned no table")
		end
		return extract_sample_values(processed, trait_id)
	end)
	if ok then
		return {
			rarity = rarity,
			endpoint = endpoint,
			level = level,
			context = context,
			result = { status = "ok", values = result },
		}
	end
	return {
		rarity = rarity,
		endpoint = endpoint,
		level = level,
		context = context,
		result = { status = "error", message = tostring(result) },
	}
end

local function collect_samples(trait_id, trait, options)
	options = options or {}
	local samples = {}
	local rarity_levels = trait.RarityLevels or { Common = { Multiplier = 1 } }
	for _, rarity in ipairs(sorted_keys(rarity_levels)) do
		if options.rarities == nil or options.rarities[rarity] then
		for _, endpoint in ipairs(rarity_endpoints(rarity_levels[rarity])) do
			local maximum_level = options.maximum_level or (trait.BlockStacking == true and 1 or 5)
			for level = 1, maximum_level do
				local sample = sample_trait(trait_id, trait, rarity, endpoint.endpoint, endpoint.multiplier, level)
				if sample.result.status == "error"
					and string.find(sample.result.message, "PercentReciprocalDelta source must remain positive", 1, true) ~= nil then
					break
				end
				table.insert(samples, sample)
			end
		end
		end
	end
	return json_array(samples)
end

local function collect_boons(ownership, localization, trait_text_references)
	local boons = {}
	for _, trait_id in ipairs(sorted_keys(ownership)) do
		local trait = game.TraitData[trait_id]
		local localized = localization[trait_id]
		if not localized or type(localized.display_name) ~= "string" or localized.display_name == "" then
			error("Missing official English name for TraitData." .. trait_id)
		end
		local processed_requirements = game.ScreenData
			and game.ScreenData.BoonInfo
			and game.ScreenData.BoonInfo.TraitRequirementsDictionary
			and game.ScreenData.BoonInfo.TraitRequirementsDictionary[trait_id]
		local requirements = processed_requirements or game.TraitRequirements[trait_id]
		local inherited = {}
		if type(trait.InheritFrom) == "table" then
			for _, value in ipairs(trait.InheritFrom) do
				inherited[value] = true
			end
		end
		local evidence_paths = { ["TraitData." .. trait_id] = true }
		for owner_id in pairs(ownership[trait_id]) do
			evidence_paths["LootData." .. owner_id] = true
		end
		if requirements ~= nil then
			evidence_paths[processed_requirements and ("ScreenData.BoonInfo.TraitRequirementsDictionary." .. trait_id) or ("TraitRequirements." .. trait_id)] = true
		end

		table.insert(boons, {
			id = trait_id,
			name = localized.display_name,
			description = localized.description or "",
			ownerIds = sorted_set_values(ownership[trait_id]),
			kind = classify_boon(trait),
			elements = collect_elements(trait),
			inheritedFrom = sorted_set_values(inherited),
			hasPrerequisites = requirements ~= nil,
			prerequisites = requirements and safe_copy(requirements, "TraitRequirements." .. trait_id) or {},
			rarityLevels = trait.RarityLevels and safe_copy(trait.RarityLevels, "TraitData." .. trait_id .. ".RarityLevels") or {},
			mechanics = collect_mechanics(trait, trait_id, trait_text_references[trait_id]),
			samples = collect_samples(trait_id, trait),
			evidence = {
				runtimePaths = sorted_set_values(evidence_paths),
				localizationPath = localized.path,
			},
		})
	end
	return json_array(boons)
end

local weapon_exporter = create_weapon_exporter({
	game = game,
	config = config,
	exporter_version = EXPORTER_VERSION,
	json_array = json_array,
	json_null = JSON_NULL,
	safe_copy = safe_copy,
	sorted_keys = sorted_keys,
	sorted_set_values = sorted_set_values,
	bytewise_less = bytewise_less,
	collect_samples = collect_samples,
})

local arcana_exporter = create_arcana_exporter({
	game = game,
	config = config,
	exporter_version = EXPORTER_VERSION,
	json_array = json_array,
	json_null = JSON_NULL,
	safe_copy = safe_copy,
	sorted_keys = sorted_keys,
	sorted_set_values = sorted_set_values,
	bytewise_less = bytewise_less,
	collect_mechanics = collect_mechanics,
	collect_samples = collect_samples,
})

local loadout_exporter = create_loadout_exporter({
	game = game,
	config = config,
	exporter_version = EXPORTER_VERSION,
	json_array = json_array,
	json_null = JSON_NULL,
	safe_copy = safe_copy,
	sorted_keys = sorted_keys,
	sorted_set_values = sorted_set_values,
	bytewise_less = bytewise_less,
	collect_samples = collect_samples,
})

local guide_exporter = create_guide_exporter({
	game = game,
	config = config,
	exporter_version = EXPORTER_VERSION,
	json_array = json_array,
	json_null = JSON_NULL,
	sorted_keys = sorted_keys,
	sorted_set_values = sorted_set_values,
	bytewise_less = bytewise_less,
	collect_samples = collect_samples,
})

local evidence_exporter = create_evidence_exporter({
	game = game,
	config = config,
	exporter_version = EXPORTER_VERSION,
	json_array = json_array,
	to_json = to_json,
	sha256 = sha256,
	write_new_file = write_new_file,
	finalize_file = finalize_file,
	log_info = function(message) rom.log.info(message) end,
})

local function create_report(package_version, localization)
	localization = localization or load_localization()
	local loot_sources, ownership = collect_loot_sources(localization)
	local trait_text_references = collect_trait_text_references(localization, ownership)
	return {
		schema = "neodes2-boon-runtime-2",
		exporterVersion = EXPORTER_VERSION,
		generatedAtUnixSeconds = os.time(),
		language = "en",
		game = {
			steamBuildId = config.steam_build_id,
			executableVersion = config.executable_version,
			packageVersion = package_version,
			acquisitionId = config.acquisition_id,
			sourceManifestSha256 = config.source_manifest_sha256,
		},
		sourceTables = json_array({ "LootData", "ScreenData.BoonInfo.TraitRequirementsDictionary", "TraitData", "TraitRequirements" }),
		localizationFiles = json_array((function()
			local result = {}
			for _, path in ipairs(LOCALIZATION_FILES) do
				table.insert(result, "Content/Game/" .. path)
			end
			table.sort(result, bytewise_less)
			return result
		end)()),
		lootSources = loot_sources,
		boons = collect_boons(ownership, localization, trait_text_references),
	}
end

local function write_finalized_report(directory, report, manifest_schema, completion_schema)
	local report_content = to_json(report)
	local report_hash = sha256(report_content)
	local report_temporary = rom.path.combine(directory, "runtime-report.json.tmp")
	local report_path = rom.path.combine(directory, "runtime-report.json")
	write_new_file(report_temporary, report_content)
	finalize_file(report_temporary, report_path)

	local manifest_content = to_json({
		schema = manifest_schema,
		exporterVersion = EXPORTER_VERSION,
		reportFile = "runtime-report.json",
		reportSha256 = report_hash,
	})
	local manifest_temporary = rom.path.combine(directory, "manifest.json.tmp")
	local manifest_path = rom.path.combine(directory, "manifest.json")
	write_new_file(manifest_temporary, manifest_content)
	finalize_file(manifest_temporary, manifest_path)

	local completion_content = to_json({
		schema = completion_schema,
		reportSha256 = report_hash,
	})
	local completion_temporary = rom.path.combine(directory, "complete.json.tmp")
	local completion_path = rom.path.combine(directory, "complete.json")
	write_new_file(completion_temporary, completion_content)
	finalize_file(completion_temporary, completion_path)
	return report_path
end

local function run_stage(label, operation)
	local started = os.clock()
	rom.log.info("NeonHades2 export: " .. label .. " started")
	local result = operation()
	rom.log.info(string.format("NeonHades2 export: %s complete (%.1f s)", label, os.clock() - started))
	return result
end

local function export_data()
	validate_config()
	local package_version = read_file(rom.path.combine(rom.paths.Content(), "packagever")):match("^%s*(.-)%s*$")
	if package_version ~= config.package_version then
		error("Installed package version " .. package_version .. " does not match configured source version " .. config.package_version)
	end

	local run_id = os.date("!%Y%m%dT%H%M%SZ") .. "-" .. tostring(os.time())
	local run_directory = rom.path.combine(_PLUGIN.plugins_data_mod_folder_path, "runs", run_id)
	rom.path.create_directory(run_directory)
	local arcana_directory = rom.path.combine(run_directory, "arcana")
	rom.path.create_directory(arcana_directory)
	local loadout_directory = rom.path.combine(run_directory, "loadouts")
	rom.path.create_directory(loadout_directory)
	local guide_directory = rom.path.combine(run_directory, "guide")
	rom.path.create_directory(guide_directory)
	local weapon_directory = rom.path.combine(run_directory, "weapons")
	rom.path.create_directory(weapon_directory)
	local evidence_directory = rom.path.combine(run_directory, "evidence")
	rom.path.create_directory(evidence_directory)
	rom.log.info("NeonHades2 export: run started (exporter " .. EXPORTER_VERSION .. ")")
	local localization = run_stage("localization", load_localization)
	local boon_report = run_stage("boon report", function() return create_report(package_version, localization) end)
	local arcana_report = run_stage("Arcana report", function() return arcana_exporter.create_report(package_version, localization) end)
	local loadout_report = run_stage("loadout report", function() return loadout_exporter.create_report(package_version, localization) end)
	local guide_report = run_stage("guide report", function() return guide_exporter.create_report(package_version, localization) end)
	local weapon_report = run_stage("weapon report", function() return weapon_exporter.create_report(package_version, localization) end)
	local evidence_manifest_path = run_stage("private evidence archive", function()
		return evidence_exporter.write_archive(evidence_directory, package_version)
	end)
	local arcana_report_path = run_stage("write Arcana report", function()
		return write_finalized_report(
			arcana_directory,
			arcana_report,
			"neodes2-arcana-runtime-manifest-1",
			"neodes2-arcana-runtime-completion-1"
		)
	end)
	local loadout_report_path = run_stage("write loadout report", function()
		return write_finalized_report(
			loadout_directory,
			loadout_report,
			"neodes2-loadout-runtime-manifest-1",
			"neodes2-loadout-runtime-completion-1"
		)
	end)
	local guide_report_path = run_stage("write guide report", function()
		return write_finalized_report(
			guide_directory,
			guide_report,
			"neodes2-guide-runtime-manifest-1",
			"neodes2-guide-runtime-completion-1"
		)
	end)
	local weapon_report_path = run_stage("write weapon report", function()
		return write_finalized_report(
			weapon_directory,
			weapon_report,
			"neodes2-weapon-runtime-manifest-1",
			"neodes2-weapon-runtime-completion-1"
		)
	end)
	local boon_report_path = run_stage("write boon report", function()
		return write_finalized_report(
			run_directory,
			boon_report,
			"neodes2-boon-runtime-manifest-1",
			"neodes2-boon-runtime-completion-1"
		)
	end)
	rom.log.info(
		"NeonHades2 data export complete: boons=" .. boon_report_path
			.. " weapons=" .. weapon_report_path
			.. " arcana=" .. arcana_report_path
			.. " loadouts=" .. loadout_report_path
			.. " guide=" .. guide_report_path
			.. " evidence=" .. evidence_manifest_path
	)
end

local has_run = false
modutil.once_loaded.save(function()
	if has_run then
		return
	end
	has_run = true
	local ok, message = pcall(export_data)
	if not ok then
		pcall(function()
			local failure_path = rom.path.combine(
				_PLUGIN.plugins_data_mod_folder_path,
				"failure-" .. tostring(os.time()) .. ".json"
			)
			write_new_file(failure_path, to_json({
				schema = "neodes2-boon-runtime-failure-1",
				exporterVersion = EXPORTER_VERSION,
				message = tostring(message),
			}))
		end)
		pcall(function()
			rom.log.warning("NeonHades2 data export failed without interrupting the game: " .. tostring(message))
		end)
	end
end)
