local ARRAY_META = { __neodes2_json_array = true }

local function array(values)
	return setmetatable(values or {}, ARRAY_META)
end

local function bytewise_less(left, right)
	local shared_length = math.min(#left, #right)
	for index = 1, shared_length do
		local left_byte = string.byte(left, index)
		local right_byte = string.byte(right, index)
		if left_byte ~= right_byte then
			return left_byte < right_byte
		end
	end
	return #left < #right
end

local function sorted_keys(value)
	local keys = {}
	for key in pairs(value) do
		if type(key) ~= "string" then
			error("JSON objects require string keys")
		end
		table.insert(keys, key)
	end
	table.sort(keys, bytewise_less)
	return keys
end

local function escape_string(value)
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

local function encode(value, ancestors)
	local value_type = type(value)
	if value_type == "string" then
		return escape_string(value)
	end
	if value_type == "boolean" then
		return value and "true" or "false"
	end
	if value_type == "number" then
		if value ~= value or value == math.huge or value == -math.huge then
			error("JSON cannot encode a non-finite number")
		end
		return tostring(value)
	end
	if value_type ~= "table" then
		error("JSON cannot encode " .. value_type)
	end
	if ancestors[value] then
		error("JSON cannot encode a cycle")
	end
	ancestors[value] = true
	local parts = {}
	local meta = getmetatable(value)
	if meta and meta.__neodes2_json_array then
		for index = 1, #value do
			table.insert(parts, encode(value[index], ancestors))
		end
		ancestors[value] = nil
		return "[" .. table.concat(parts, ",") .. "]"
	end
	for _, key in ipairs(sorted_keys(value)) do
		table.insert(parts, escape_string(key) .. ":" .. encode(value[key], ancestors))
	end
	ancestors[value] = nil
	return "{" .. table.concat(parts, ",") .. "}"
end

return {
	array = array,
	encode_line = function(value)
		return encode(value, {}) .. "\n"
	end,
}
