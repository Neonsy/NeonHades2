---@diagnostic disable

return function(deps)
	local game = deps.game
	local json_array = deps.json_array
	local exporter_version = deps.exporter_version
	local MAX_DEPTH = 128
	local MAX_NODES = 1000000

	local forbidden_names = {
		AudioState = true,
		CodexStatus = true,
		ConfigOptionCache = true,
		DebugState = true,
		FrameState = true,
		GameState = true,
		GamepadCursorRequests = true,
		HotLoadInfo = true,
		MapState = true,
		ManaDataStore = true,
		NextSeeds = true,
		NotifyResultsTable = true,
		PrevRun = true,
		QueuedTextLines = true,
		ScreenState = true,
		SessionMapState = true,
		SessionState = true,
		Hero = true,
		SaveFile = true,
		SaveName = true,
		ScreenAnchors = true,
		TextLinesCache = true,
		UserDebugEquip = true,
	}

	local runtime_namespace_names = {
		_coroutinePool = true,
		_eventListeners = true,
		_events = true,
		_eventTimeoutRecord = true,
		_G = true,
		_tagsToKill = true,
		_threads = true,
		_workingThreads = true,
		GLOBALS = true,
		ModUtil = true,
		Pickle = true,
		bit32 = true,
		coroutine = true,
		debug = true,
		io = true,
		luabins = true,
		math = true,
		os = true,
		package = true,
		rom = true,
		string = true,
		table = true,
		utf8 = true,
	}

	local function is_forbidden_name(name)
		return forbidden_names[name] == true
			or string.sub(name, 1, 7) == "Current"
			or string.sub(name, 1, 6) == "Active"
			or string.sub(name, 1, 7) == "Pending"
	end

	local function scalar_key_less(left, right)
		local left_type = type(left)
		local right_type = type(right)
		if left_type ~= right_type then
			return left_type < right_type
		end
		if left_type == "boolean" then
			return tostring(left) < tostring(right)
		end
		return left < right
	end

	local function omission(state, value_type, reason)
		state.omission_counts[value_type .. ":" .. reason] =
			(state.omission_counts[value_type .. ":" .. reason] or 0) + 1
		return { omitted = true, valueType = value_type, reason = reason }
	end

	local function encode_value(value, state, depth)
		local value_type = type(value)
		if value_type == "string" or value_type == "boolean" then
			return value
		end
		if value_type == "number" then
			if value ~= value or value == math.huge or value == -math.huge then
				return omission(state, value_type, "non-finite")
			end
			return value
		end
		if value_type ~= "table" then
			return omission(state, value_type, "not-data")
		end
		if state.forbidden_values[value] then
			return omission(state, value_type, "player-state")
		end
		if state.excluded_values[value] then
			return omission(state, value_type, "runtime-namespace")
		end
		local existing = state.ids[value]
		if existing then
			return { ref = existing }
		end
		if depth > MAX_DEPTH then
			error("Processed table exceeds evidence archive depth limit")
		end
		local keys = {}
		local readable = pcall(function()
			for key in pairs(value) do
				local key_type = type(key)
				if key_type == "string" or key_type == "number" or key_type == "boolean" then
					table.insert(keys, key)
				else
					omission(state, key_type, "unsupported-key")
				end
			end
		end)
		if not readable then
			return omission(state, value_type, "uninspectable-container")
		end
		state.node_count = state.node_count + 1
		if state.node_count > MAX_NODES then
			error("Processed archive exceeds evidence node limit")
		end
		local id = state.node_count
		state.ids[value] = id
		local node = { id = id, entries = json_array({}) }
		table.insert(state.chunk_nodes, node)
		table.sort(keys, scalar_key_less)
		for _, key in ipairs(keys) do
			local readable_value, child = pcall(function() return value[key] end)
			table.insert(node.entries, {
				key = key,
				keyType = type(key),
				value = readable_value
					and encode_value(child, state, depth + 1)
					or omission(state, "unknown", "unreadable-value"),
			})
		end
		local readable_metatable, metatable = pcall(getmetatable, value)
		if not readable_metatable then
			omission(state, "table", "unreadable-metatable")
		elseif metatable ~= nil then
			omission(state, "table", "metatable")
		end
		return { ref = id }
	end

	local function archive_table(state, name, value)
		state.chunk_nodes = {}
		state.omission_counts = {}
		local root = encode_value(value, state, 0)
		local omissions = {}
		for key, count in pairs(state.omission_counts) do
			table.insert(omissions, { kind = key, count = count })
		end
		table.sort(omissions, function(left, right) return left.kind < right.kind end)
		return {
			schema = "neodes2-processed-table-evidence-2",
			tableName = name,
			root = root,
			nodes = json_array(state.chunk_nodes),
			omissions = json_array(omissions),
		}
	end

	local function write_archive(directory, package_version)
		local candidates = {}
		local denied = {}
		local excluded = {}
		local forbidden_values = {}
		local excluded_values = {}
		for name, value in pairs(game) do
			if type(name) == "string" and type(value) == "table" then
				if is_forbidden_name(name) then
					forbidden_values[value] = true
					table.insert(denied, name)
				elseif runtime_namespace_names[name] then
					excluded_values[value] = true
					table.insert(excluded, name)
				else
					candidates[name] = value
				end
			end
		end

		local table_names = {}
		local table_values = {}
		for name, value in pairs(candidates) do
			if forbidden_values[value] then
				table.insert(denied, name)
			elseif excluded_values[value] then
				table.insert(excluded, name)
			else
				table.insert(table_names, name)
				table_values[name] = value
			end
		end
		table.sort(table_names)
		table.sort(denied)
		table.sort(excluded)

		local state = {
			ids = {},
			chunk_nodes = {},
			node_count = 0,
			omission_counts = {},
			forbidden_values = forbidden_values,
			excluded_values = excluded_values,
		}
		local files = {}
		local total_bytes = 0
		local started = os.clock()
		deps.log_info(string.format(
			"NeonHades2 evidence archive: starting %d tables (%d player-state denied, %d runtime namespaces excluded)",
			#table_names,
			#denied,
			#excluded
		))
		for index, name in ipairs(table_names) do
			deps.log_info(string.format("NeonHades2 evidence archive: table %d/%d %s", index, #table_names, name))
			local content = deps.to_json(archive_table(state, name, table_values[name]))
			local file_name = string.format("table-%05d.json", index)
			local temporary = rom.path.combine(directory, file_name .. ".tmp")
			local final = rom.path.combine(directory, file_name)
			deps.write_new_file(temporary, content)
			deps.finalize_file(temporary, final)
			total_bytes = total_bytes + #content
			table.insert(files, { tableName = name, file = file_name, sha256 = deps.sha256(content) })
			deps.log_info(string.format(
				"NeonHades2 evidence archive: wrote %d/%d %s (%.1f MiB total, %.1f s elapsed)",
				index,
				#table_names,
				name,
				total_bytes / 1048576,
				os.clock() - started
			))
		end

		local manifest_content = deps.to_json({
			schema = "neodes2-runtime-evidence-manifest-2",
			exporterVersion = exporter_version,
			game = {
				steamBuildId = deps.config.steam_build_id,
				executableVersion = deps.config.executable_version,
				packageVersion = package_version,
				acquisitionId = deps.config.acquisition_id,
				sourceManifestSha256 = deps.config.source_manifest_sha256,
			},
			files = json_array(files),
			totalNodeCount = state.node_count,
			deniedPlayerStateTables = json_array(denied),
			excludedRuntimeNamespaces = json_array(excluded),
		})
		local manifest_temporary = rom.path.combine(directory, "manifest.json.tmp")
		local manifest_path = rom.path.combine(directory, "manifest.json")
		deps.write_new_file(manifest_temporary, manifest_content)
		deps.finalize_file(manifest_temporary, manifest_path)
		local completion_content = deps.to_json({
			schema = "neodes2-runtime-evidence-completion-2",
			manifestSha256 = deps.sha256(manifest_content),
		})
		local completion_temporary = rom.path.combine(directory, "complete.json.tmp")
		deps.write_new_file(completion_temporary, completion_content)
		deps.finalize_file(completion_temporary, rom.path.combine(directory, "complete.json"))
		deps.log_info(string.format(
			"NeonHades2 evidence archive: complete (%d tables, %d shared nodes, %.1f MiB, %.1f s)",
			#table_names,
			state.node_count,
			total_bytes / 1048576,
			os.clock() - started
		))
		return manifest_path
	end

	return { write_archive = write_archive }
end
