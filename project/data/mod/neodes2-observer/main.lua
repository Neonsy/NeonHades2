---@meta _
---@diagnostic disable

local OBSERVER_VERSION = "0.1.0"

local envy = rom.mods["SGG_Modding-ENVY"]
envy.auto()

local modutil = rom.mods["SGG_Modding-ModUtil"]
local game = rom.game
local config = import "config.lua"
local json = import "json.lua"

local trace_path = nil
local sequence = -1
local recording_failed = false
local registered = false

local function nonempty_string(value, field)
	if type(value) ~= "string" or value == "" then
		error("Observer config field " .. field .. " must be a nonempty string")
	end
	return value
end

local function validate_config()
	if type(config) ~= "table" or config.schema ~= "neodes2-observer-config-1" then
		error("Missing or unsupported NeonHades2 observer config")
	end
	for _, field in ipairs({
		"source_acquisition_id",
		"source_manifest_sha256",
		"dataset_acquisition_id",
		"dataset_sha256",
		"steam_build_id",
		"executable_version",
		"package_version",
	}) do
		nonempty_string(config[field], field)
	end
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

local function file_exists(path)
	local file = io.open(path, "rb")
	if file then
		file:close()
		return true
	end
	return false
end

local function append_line(path, value)
	local content = json.encode_line(value)
	local file, message = io.open(path, "ab")
	if not file then
		error(message or ("Unable to append " .. path))
	end
	local write_ok, write_message = file:write(content)
	local flush_ok, flush_message = file:flush()
	local close_ok, close_message = file:close()
	if not write_ok then
		error(write_message or ("Unable to append " .. path))
	end
	if flush_ok == nil then
		error(flush_message or ("Unable to flush " .. path))
	end
	if close_ok == nil then
		error(close_message or ("Unable to close " .. path))
	end
end

local function finite_number(value)
	if type(value) ~= "number" or value ~= value or value == math.huge or value == -math.huge then
		return nil
	end
	return value
end

local function string_value(value)
	if type(value) == "string" and value ~= "" then
		return value
	end
	return nil
end

local function sorted_string_keys(value)
	local result = {}
	if type(value) ~= "table" then
		return json.array(result)
	end
	for key, present in pairs(value) do
		if present and type(key) == "string" then
			table.insert(result, key)
		end
	end
	table.sort(result)
	return json.array(result)
end

local function sorted_trait_ids(hero)
	local seen = {}
	if type(hero) == "table" and type(hero.Traits) == "table" then
		for _, trait in ipairs(hero.Traits) do
			if type(trait) == "table" and type(trait.Name) == "string" then
				seen[trait.Name] = true
			end
		end
	end
	return sorted_string_keys(seen)
end

local function current_context()
	local run = game.CurrentRun
	local hero = type(run) == "table" and run.Hero or nil
	local room = type(run) == "table" and run.CurrentRoom or nil
	local equipped_weapon_id = nil
	if type(game.GetEquippedWeapon) == "function" and type(hero) == "table" then
		local ok, value = pcall(game.GetEquippedWeapon)
		if ok then
			equipped_weapon_id = string_value(value)
		end
	end
	local active_aspect_id = nil
	if equipped_weapon_id and type(game.GameState) == "table" and type(game.GameState.LastWeaponUpgradeName) == "table" then
		active_aspect_id = string_value(game.GameState.LastWeaponUpgradeName[equipped_weapon_id])
	end
	if active_aspect_id == nil and equipped_weapon_id and type(game.ScreenData) == "table" then
		local screen = game.ScreenData.WeaponUpgradeScreen
		if type(screen) == "table" and type(screen.FreeUnlocks) == "table" then
			active_aspect_id = string_value(screen.FreeUnlocks[equipped_weapon_id])
		end
	end
	return {
		roomId = type(room) == "table" and string_value(room.Name) or nil,
		roomSetId = type(room) == "table" and string_value(room.RoomSetName) or nil,
		equippedWeaponId = equipped_weapon_id,
		activeAspectId = active_aspect_id,
		traitIds = sorted_trait_ids(hero),
		weaponIds = type(hero) == "table" and sorted_string_keys(hero.Weapons) or json.array({}),
		health = type(hero) == "table" and finite_number(hero.Health) or nil,
		maxHealth = type(hero) == "table" and finite_number(hero.MaxHealth) or nil,
		mana = type(hero) == "table" and finite_number(hero.Mana) or nil,
		maxMana = type(hero) == "table" and finite_number(hero.MaxMana) or nil,
	}
end

local function hero_object_id()
	local run = game.CurrentRun
	local hero = type(run) == "table" and run.Hero or nil
	return type(hero) == "table" and finite_number(hero.ObjectId) or nil
end

local function actor_fields(actor)
	local object_id = type(actor) == "table" and finite_number(actor.ObjectId) or nil
	local hero_id = hero_object_id()
	return {
		actorId = object_id,
		actorName = type(actor) == "table" and string_value(actor.Name) or nil,
		actorIsHero = object_id ~= nil and hero_id ~= nil and object_id == hero_id or nil,
	}
end

local function target_fields(target)
	local object_id = type(target) == "table" and finite_number(target.ObjectId) or nil
	local hero_id = hero_object_id()
	return {
		targetId = object_id,
		targetName = type(target) == "table" and string_value(target.Name) or nil,
		targetIsHero = object_id ~= nil and hero_id ~= nil and object_id == hero_id or nil,
	}
end

local function add_fields(target, source)
	for key, value in pairs(source) do
		if value ~= nil then
			target[key] = value
		end
	end
	return target
end

local function scalar_argument(trigger_args, names, expected_type)
	if type(trigger_args) ~= "table" then
		return nil
	end
	for _, name in ipairs(names) do
		local value = trigger_args[name]
		if expected_type == "number" then
			value = finite_number(value)
		elseif expected_type == "string" then
			value = string_value(value)
		elseif expected_type == "boolean" and type(value) ~= "boolean" then
			value = nil
		end
		if value ~= nil then
			return value
		end
	end
	return nil
end

local function write_event(kind, event, identity)
	if trace_path == nil or recording_failed then
		return
	end
	sequence = sequence + 1
	append_line(trace_path, {
		schema = "neodes2-observation-event-1",
		sequence = sequence,
		kind = kind,
		worldTime = finite_number(game._worldTime),
		worldTimeUnmodified = finite_number(game._worldTimeUnmodified),
		context = current_context(),
		event = event or {},
		identity = identity,
	})
end

local function safe_event(kind, event, identity)
	if trace_path == nil or recording_failed then
		return
	end
	local ok, message = pcall(write_event, kind, event, identity)
	if not ok then
		recording_failed = true
		pcall(function()
			rom.log.warning("NeonHades2 observer stopped after a trace write failure: " .. tostring(message))
		end)
	end
end

local function start_session()
	validate_config()
	local package_version = read_file(rom.path.combine(rom.paths.Content(), "packagever")):match("^%s*(.-)%s*$")
	if package_version ~= config.package_version then
		error("Installed package version " .. package_version .. " does not match configured source version " .. config.package_version)
	end
	local runs_directory = rom.path.combine(_PLUGIN.plugins_data_mod_folder_path, "runs")
	rom.path.create_directory(runs_directory)
	local base_id = os.date("!%Y%m%dT%H%M%SZ") .. "-" .. tostring(os.time())
	local suffix = 1
	while true do
		local run_id = suffix == 1 and base_id or base_id .. "-" .. tostring(suffix)
		local run_directory = rom.path.combine(runs_directory, run_id)
		local candidate = rom.path.combine(run_directory, "trace.ndjson")
		if not file_exists(candidate) then
			rom.path.create_directory(run_directory)
			trace_path = candidate
			break
		end
		suffix = suffix + 1
	end
	sequence = -1
	recording_failed = false
	write_event("session-start", {}, {
		observerVersion = OBSERVER_VERSION,
		sourceAcquisitionId = config.source_acquisition_id,
		sourceManifestSha256 = config.source_manifest_sha256,
		datasetAcquisitionId = config.dataset_acquisition_id,
		datasetSha256 = config.dataset_sha256,
		steamBuildId = config.steam_build_id,
		executableVersion = config.executable_version,
		packageVersion = config.package_version,
	})
	rom.log.info("NeonHades2 observer recording: " .. trace_path)
end

local function register_control(control_id)
	game.OnControlPressed({ control_id, function(trigger_args)
		safe_event("control-pressed", {
			controlId = control_id,
			triggerName = scalar_argument(trigger_args, { "name", "Name", "ControlName", "controlName" }, "string"),
		})
	end })
	game.OnControlReleased({ control_id, function(trigger_args)
		safe_event("control-released", {
			controlId = control_id,
			triggerName = scalar_argument(trigger_args, { "name", "Name", "ControlName", "controlName" }, "string"),
		})
	end })
end

local function register_events()
	if registered then
		return
	end
	registered = true
	for _, control_id in ipairs({ "Attack1", "Attack2", "Attack3", "Rush", "Shout" }) do
		register_control(control_id)
	end
	game.OnWeaponCharging({ function(trigger_args)
		local event = add_fields({
			weaponId = scalar_argument(trigger_args, { "name", "WeaponName", "SourceWeapon" }, "string"),
		}, actor_fields(type(trigger_args) == "table" and trigger_args.OwnerTable or nil))
		safe_event("weapon-charging", event)
	end })
	game.OnWeaponChargeCanceled({ function(trigger_args)
		local event = add_fields({
			weaponId = scalar_argument(trigger_args, { "name", "WeaponName", "SourceWeapon" }, "string"),
			postFire = scalar_argument(trigger_args, { "PostFire" }, "boolean"),
		}, actor_fields(type(trigger_args) == "table" and trigger_args.OwnerTable or nil))
		safe_event("weapon-charge-canceled", event)
	end })
	game.OnPerfectChargeWindowEntered({ function(trigger_args)
		local event = add_fields({
			weaponId = scalar_argument(trigger_args, { "name", "WeaponName", "SourceWeapon" }, "string"),
		}, actor_fields(type(trigger_args) == "table" and trigger_args.OwnerTable or nil))
		safe_event("perfect-charge-window", event)
	end })
	game.OnWeaponFired({ function(trigger_args)
		local event = add_fields({
			weaponId = scalar_argument(trigger_args, { "name", "WeaponName", "SourceWeapon" }, "string"),
			projectileId = scalar_argument(trigger_args, { "ProjectileName", "SourceProjectile" }, "string"),
			projectileVolley = scalar_argument(trigger_args, { "ProjectileVolley" }, "number"),
			projectileCount = scalar_argument(trigger_args, { "NumProjectiles" }, "number"),
			ammo = scalar_argument(trigger_args, { "Ammo" }, "number"),
			perfectCharge = scalar_argument(trigger_args, { "IsPerfectCharge" }, "boolean"),
		}, actor_fields(type(trigger_args) == "table" and trigger_args.OwnerTable or nil))
		if event.weaponId and type(game.MapState) == "table" and type(game.MapState.WeaponCharge) == "table" then
			event.chargeStage = finite_number(game.MapState.WeaponCharge[event.weaponId])
		end
		safe_event("weapon-fired", event)
	end })
	game.OnProjectileCreation({ function(trigger_args)
		local event = add_fields({
			projectileId = scalar_argument(trigger_args, { "name", "ProjectileName" }, "string"),
			projectileInstanceId = scalar_argument(trigger_args, { "ProjectileId" }, "number"),
		}, actor_fields(type(trigger_args) == "table" and trigger_args.TriggeredByTable or nil))
		safe_event("projectile-created", event)
	end })
	game.OnProjectileDeath({ function(trigger_args)
		local actor = type(trigger_args) == "table" and trigger_args.AttackerTable or nil
		local event = add_fields({
			projectileId = scalar_argument(trigger_args, { "name", "ProjectileName", "SourceProjectile" }, "string"),
			projectileInstanceId = scalar_argument(trigger_args, { "ProjectileId" }, "number"),
			weaponId = scalar_argument(trigger_args, { "WeaponName", "SourceWeapon" }, "string"),
		}, actor_fields(actor))
		safe_event("projectile-death", event)
	end })
	game.OnHit({ function(trigger_args)
		local victim = type(trigger_args) == "table" and trigger_args.Victim or nil
		local event = add_fields({
			weaponId = scalar_argument(trigger_args, { "SourceWeapon", "WeaponName" }, "string"),
			projectileId = scalar_argument(trigger_args, { "SourceProjectile", "ProjectileName" }, "string"),
			projectileInstanceId = scalar_argument(trigger_args, { "ProjectileId" }, "number"),
			damageAmount = scalar_argument(trigger_args, { "DamageAmount" }, "number"),
		}, actor_fields(type(trigger_args) == "table" and trigger_args.AttackerTable or nil))
		add_fields(event, target_fields(victim))
		safe_event("hit", event)
	end })
	game.OnEffectApply({ function(trigger_args)
		local victim = type(trigger_args) == "table" and trigger_args.Victim or nil
		local actor = type(trigger_args) == "table" and (trigger_args.AttackerTable or trigger_args.SourceTable) or nil
		local event = add_fields({
			effectId = scalar_argument(trigger_args, { "EffectName", "name" }, "string"),
			stacks = scalar_argument(trigger_args, { "Stacks" }, "number"),
			reapplied = scalar_argument(trigger_args, { "Reapplied" }, "boolean"),
		}, actor_fields(actor))
		add_fields(event, target_fields(victim))
		safe_event("effect-applied", event)
	end })
	game.OnEffectCleared({ function(trigger_args)
		local victim = type(trigger_args) == "table" and trigger_args.Victim or nil
		local event = {
			effectId = scalar_argument(trigger_args, { "EffectName", "name" }, "string"),
			exists = scalar_argument(trigger_args, { "Exists" }, "boolean"),
		}
		add_fields(event, target_fields(victim))
		safe_event("effect-cleared", event)
	end })
	game.OnEffectStackDecrease({ function(trigger_args)
		local victim = type(trigger_args) == "table" and trigger_args.Victim or nil
		local event = {
			effectId = scalar_argument(trigger_args, { "EffectName", "name" }, "string"),
			stacks = scalar_argument(trigger_args, { "Stacks" }, "number"),
		}
		add_fields(event, target_fields(victim))
		safe_event("effect-stack-decreased", event)
	end })
end

modutil.once_loaded.game(function()
	local ok, message = pcall(register_events)
	if not ok then
		pcall(function()
			rom.log.warning("NeonHades2 observer could not register events: " .. tostring(message))
		end)
	end
end)

modutil.once_loaded.save(function()
	local ok, message = pcall(start_session)
	if not ok then
		trace_path = nil
		recording_failed = true
		pcall(function()
			rom.log.warning("NeonHades2 observer could not start recording: " .. tostring(message))
		end)
	end
end)
