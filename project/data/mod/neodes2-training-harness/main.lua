---@meta _
---@diagnostic disable

local HARNESS_VERSION = "0.1.0"

local envy = rom.mods["SGG_Modding-ENVY"]
envy.auto()

local modutil = rom.mods["SGG_Modding-ModUtil"]
local game = rom.game
local config = import "config.lua"

local GENERATION_KEY = "NeonHades2TrainingHarnessGeneration"
local session_nonce = nil
local armed = false
local last_command_id = nil
local original_state = nil

local function nonempty_string(value, field)
	if type(value) ~= "string" or value == "" then
		error("Training config field " .. field .. " must be a nonempty string")
	end
	return value
end

local function validate_config()
	if type(config) ~= "table" or config.schema ~= "neodes2-training-config-1" then
		error("Missing or unsupported NeonHades2 training config")
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
	local file = io.open(path, "rb")
	if not file then
		return nil
	end
	local content = file:read("*all")
	file:close()
	return content
end

local function write_file(path, content)
	local file, message = io.open(path, "wb")
	if not file then
		error(message or ("Unable to write " .. path))
	end
	local write_ok, write_message = file:write(content)
	local flush_ok, flush_message = file:flush()
	local close_ok, close_message = file:close()
	if not write_ok then
		error(write_message or ("Unable to write " .. path))
	end
	if flush_ok == nil then
		error(flush_message or ("Unable to flush " .. path))
	end
	if close_ok == nil then
		error(close_message or ("Unable to close " .. path))
	end
end

local function render_document(fields)
	local lines = {}
	for _, field in ipairs(fields) do
		if type(field[2]) == "string" and field[2] ~= "" then
			table.insert(lines, field[1] .. "=" .. field[2])
		end
	end
	return table.concat(lines, "\n") .. "\n"
end

local function parse_document(path)
	local content = read_file(path)
	if content == nil or content:sub(-1) ~= "\n" then
		return nil
	end
	local result = {}
	for line in content:gmatch("([^\n]+)\n") do
		local key, value = line:match("^([a-z0-9_]+)=(.*)$")
		if key == nil or value == "" or result[key] ~= nil then
			return nil
		end
		result[key] = value
	end
	return result
end

local function current_weapon_id()
	if type(game.GetEquippedWeapon) ~= "function" then
		return nil
	end
	local ok, value = pcall(game.GetEquippedWeapon)
	if ok and type(value) == "string" and value ~= "" then
		return value
	end
	return nil
end

local function current_aspect()
	local run = game.CurrentRun
	local hero = type(run) == "table" and run.Hero or nil
	local weapon_id = current_weapon_id()
	if type(hero) ~= "table" or type(hero.Traits) ~= "table" then
		return nil, nil, false
	end
	for _, trait in ipairs(hero.Traits) do
		if type(trait) == "table" and trait.IsWeaponEnchantment and
			(trait.RequiredWeapon == nil or trait.RequiredWeapon == weapon_id) and
			type(trait.Name) == "string" then
			return trait.Name, type(trait.Rarity) == "string" and trait.Rarity or "Common", true
		end
	end
	local fallback = type(game.GameState) == "table" and type(game.GameState.LastWeaponUpgradeName) == "table" and
		game.GameState.LastWeaponUpgradeName[weapon_id] or nil
	return type(fallback) == "string" and fallback or nil, "Common", false
end

local function append_values(target, values)
	if type(values) == "table" then
		for _, value in ipairs(values) do
			table.insert(target, value)
		end
	end
end

local function runtime_equip_weapon(weapon_id)
	local run = game.CurrentRun
	local hero = type(run) == "table" and run.Hero or nil
	local weapon_data = type(game.WeaponData) == "table" and game.WeaponData[weapon_id] or nil
	if type(hero) ~= "table" or type(weapon_data) ~= "table" or type(hero.ObjectId) ~= "number" then
		error("Training weapon is unavailable: " .. tostring(weapon_id))
	end
	local weapon_sets = type(game.WeaponSets) == "table" and game.WeaponSets or nil
	local primary_weapons = type(weapon_sets) == "table" and weapon_sets.HeroPrimaryWeapons or nil
	local linked_sets = type(weapon_sets) == "table" and weapon_sets.HeroWeaponSets or nil
	if type(primary_weapons) ~= "table" or type(linked_sets) ~= "table" then
		error("Hero weapon sets are unavailable")
	end
	hero.Weapons = hero.Weapons or {}
	game.MapState.EquippedWeapons = game.MapState.EquippedWeapons or {}
	hero.Weapons[weapon_id] = true
	if type(weapon_data.SecondaryWeapon) == "string" then
		hero.Weapons[weapon_data.SecondaryWeapon] = true
	end
	local to_equip = { weapon_id }
	append_values(to_equip, linked_sets[weapon_id])
	game.EquipWeapon({ DestinationId = hero.ObjectId, Names = to_equip, LoadPackages = true })
	for _, name in ipairs(to_equip) do
		game.MapState.EquippedWeapons[name] = true
	end
	local to_unequip = {}
	for _, other_id in ipairs(primary_weapons) do
		if other_id ~= weapon_id then
			hero.Weapons[other_id] = nil
			local other_data = game.WeaponData[other_id]
			if type(other_data) == "table" then
				if type(other_data.SecondaryWeapon) == "string" then
					hero.Weapons[other_data.SecondaryWeapon] = nil
				end
				table.insert(to_unequip, other_id)
				append_values(to_unequip, linked_sets[other_id])
				if type(other_data.DummyTraitName) == "string" then
					game.RemoveTrait(hero, other_data.DummyTraitName, { SkipQuestStatusCheck = true })
				end
				if type(other_data.UnequipFunctionName) == "string" then
					game.thread(game.CallFunctionName, other_data.UnequipFunctionName)
				end
				if type(other_data.UnequipFunctionName2) == "string" then
					game.thread(game.CallFunctionName, other_data.UnequipFunctionName2)
				end
			end
		end
	end
	if #to_unequip > 0 then
		game.UnequipWeapon({ DestinationId = hero.ObjectId, Names = to_unequip, UnloadPackages = false })
		for _, name in ipairs(to_unequip) do
			game.MapState.EquippedWeapons[name] = nil
		end
	end
	if type(weapon_data.SprintDisableEffectName) == "string" then
		game.SetWeaponProperty({
			WeaponName = "WeaponSprint",
			DestinationId = hero.ObjectId,
			Property = "DisableFireWithEffect2",
			Value = weapon_data.SprintDisableEffectName,
		})
	end
	if type(game.HandleWeaponAnimSwaps) == "function" then
		game.HandleWeaponAnimSwaps()
	end
	if weapon_data.MaxAmmo and type(game.ReloadAmmo) == "function" then
		game.ReloadAmmo(weapon_data)
	end
	if type(game.RefillMana) == "function" then
		game.RefillMana()
	end
	if type(game.OrderAndApplyPropertyChanges) == "function" and type(game.ToLookup) == "function" then
		game.OrderAndApplyPropertyChanges(game.ToLookup(to_equip))
	end
end

local function remove_current_aspect()
	if type(game.UnequipWeaponUpgrade) ~= "function" then
		return
	end
	local aspect_id, _, had_aspect_trait = current_aspect()
	local trait_data = had_aspect_trait and type(game.TraitData) == "table" and game.TraitData[aspect_id] or nil
	if type(trait_data) == "table" and trait_data.LinkedSpell then
		local spell_data = type(game.SpellData) == "table" and game.SpellData[trait_data.LinkedSpell] or nil
		if type(spell_data) ~= "table" or type(spell_data.TraitName) ~= "string" or
			type(game.GetHeroTrait) ~= "function" then
			error("Current training aspect linked spell is unavailable")
		end
		if type(game.UpdateHeroTraitDictionary) == "function" then
			game.UpdateHeroTraitDictionary()
		end
		if game.GetHeroTrait(spell_data.TraitName) == nil then
			local repaired = game.AddTraitToHero({
				TraitName = spell_data.TraitName,
				SkipNewTraitHighlight = true,
				SkipUIUpdate = true,
				SkipQuestStatusCheck = true,
			})
			if type(repaired) ~= "table" then
				error("Current training aspect linked spell could not be repaired")
			end
		end
	end
	local skip_unequip_function = false
	if type(trait_data) == "table" and type(trait_data.OnUnequipFunctionName) == "string" then
		if type(game.CallFunctionName) ~= "function" then
			error("Current training aspect cleanup is unavailable")
		end
		game.CallFunctionName(trait_data.OnUnequipFunctionName)
		skip_unequip_function = true
	end
	game.UnequipWeaponUpgrade({ SkipUIUpdate = true, SkipUnequipFunctionName = skip_unequip_function })
	if skip_unequip_function then
		game.wait(0.1)
	end
end

local function update_aspect_weapon_models(aspect_id, trait_data)
	local weapon_kit_found = false
	if type(game.MapState) == "table" and type(game.MapState.WeaponKits) == "table" then
		for _, weapon_kit in pairs(game.MapState.WeaponKits) do
			if type(weapon_kit) == "table" and weapon_kit.Name == trait_data.RequiredWeapon then
				weapon_kit_found = true
				break
			end
		end
	end
	local weapon_kit_updated = false
	if type(game.UpdateWeaponKitUpgrade) == "function" then
		game.UpdateWeaponKitUpgrade(trait_data.RequiredWeapon, aspect_id)
		weapon_kit_updated = weapon_kit_found
	end
	if weapon_kit_updated or type(trait_data.ReplacementGrannyModels) ~= "table" then
		return
	end
	if type(game.SetThingProperty) ~= "function" or type(game.CurrentRun) ~= "table" or
		type(game.CurrentRun.Hero) ~= "table" or type(game.CurrentRun.Hero.ObjectId) ~= "number" then
		error("Training aspect weapon model update is unavailable")
	end
	for original_model, replacement_model in pairs(trait_data.ReplacementGrannyModels) do
		game.SetThingProperty({
			Property = "GrannyAlternateModelAttachment",
			Value = replacement_model,
			OriginalAttachmentModel = original_model,
			DestinationId = game.CurrentRun.Hero.ObjectId,
		})
	end
end

local function add_aspect(aspect_id, rarity)
	local trait_data = type(game.TraitData) == "table" and game.TraitData[aspect_id] or nil
	if type(trait_data) ~= "table" or not trait_data.IsWeaponEnchantment then
		error("Training aspect is unavailable: " .. tostring(aspect_id))
	end
	local spell_data = nil
	if trait_data.LinkedSpell then
		spell_data = type(game.SpellData) == "table" and game.SpellData[trait_data.LinkedSpell] or nil
		if type(spell_data) ~= "table" or type(spell_data.TraitName) ~= "string" or spell_data.TraitName == "" then
			error("Training aspect linked spell is unavailable: " .. tostring(trait_data.LinkedSpell))
		end
		if type(game.DeepCopyTable) ~= "function"
			or type(game.CreateTalentTree) ~= "function"
			or type(game.UpdateTalentPointInvestedCache) ~= "function"
			or type(game.UpdateSpellActiveStatus) ~= "function" then
			error("Training aspect linked spell setup is unavailable")
		end
	end
	local added = game.AddTraitToHero({
		TraitName = aspect_id,
		Rarity = rarity or "Common",
		SkipNewTraitHighlight = true,
		SkipUIUpdate = true,
		SkipQuestStatusCheck = true,
	})
	if added == nil then
		error("Training aspect could not be added: " .. aspect_id)
	end
	local weapon_data = game.WeaponData[trait_data.RequiredWeapon]
	if type(weapon_data) == "table" and type(weapon_data.DummyTraitName) == "string" then
		game.RemoveTrait(game.CurrentRun.Hero, weapon_data.DummyTraitName, { SkipUIUpdate = true, SkipQuestStatusCheck = true })
	end
	if spell_data ~= nil then
		local spell_trait = game.AddTraitToHero({
			TraitName = spell_data.TraitName,
			SkipNewTraitHighlight = true,
			SkipUIUpdate = true,
			SkipQuestStatusCheck = true,
		})
		if type(spell_trait) ~= "table" then
			error("Training aspect linked spell could not be added: " .. spell_data.TraitName)
		end
		if spell_trait.CheckChargeFunctionName then
			game.thread(game.CallFunctionName, spell_trait.CheckChargeFunctionName, game.CurrentRun.Hero)
		end
		game.CurrentRun.Hero.SlottedSpell = game.DeepCopyTable(spell_data)
		game.CurrentRun.Hero.SlottedSpell.Talents = game.DeepCopyTable(game.CreateTalentTree(spell_data))
		game.UpdateTalentPointInvestedCache()
		game.UpdateSpellActiveStatus()
	end
	if type(game.UpdateHeroTraitDictionary) == "function" then
		game.UpdateHeroTraitDictionary()
	end
	update_aspect_weapon_models(aspect_id, trait_data)
end

local function apply_aspect(command)
	local weapon_id = nonempty_string(command.weapon_id, "weapon_id")
	local aspect_id = nonempty_string(command.aspect_id, "aspect_id")
	local trait_data = type(game.TraitData) == "table" and game.TraitData[aspect_id] or nil
	if type(trait_data) ~= "table" or trait_data.RequiredWeapon ~= weapon_id then
		error("Training aspect does not belong to the requested weapon")
	end
	remove_current_aspect()
	runtime_equip_weapon(weapon_id)
	add_aspect(aspect_id, "Common")
end

local function restore_original()
	if type(original_state) ~= "table" or type(original_state.weapon_id) ~= "string" then
		error("Original training state is unavailable")
	end
	remove_current_aspect()
	runtime_equip_weapon(original_state.weapon_id)
	if original_state.had_aspect_trait and type(original_state.aspect_id) == "string" then
		add_aspect(original_state.aspect_id, original_state.aspect_rarity)
	else
		local weapon_data = game.WeaponData[original_state.weapon_id]
		if type(weapon_data) == "table" and type(weapon_data.DummyTraitName) == "string" then
			game.AddTraitToHero({
				TraitName = weapon_data.DummyTraitName,
				SkipNewTraitHighlight = true,
				SkipUIUpdate = true,
				SkipQuestStatusCheck = true,
			})
		end
	end
	game.GameState.LastPickedTraitName = original_state.last_picked_trait_name
end

local function validate_command(command)
	local allowed = {
		schema = true,
		dataset_acquisition_id = true,
		command_id = true,
		action = true,
		weapon_id = true,
		aspect_id = true,
		["end"] = true,
	}
	for key in pairs(command) do
		if not allowed[key] then
			error("Unexpected training command field: " .. key)
		end
	end
	if command.schema ~= "neodes2-training-command-1" or command["end"] ~= command.schema then
		error("Unsupported or incomplete training command")
	end
	if command.dataset_acquisition_id ~= config.dataset_acquisition_id then
		error("Training command dataset does not match the configured dataset")
	end
	nonempty_string(command.command_id, "command_id")
	if command.action ~= "aspect" and command.action ~= "restore" then
		error("Unsupported training command action")
	end
	if command.action == "aspect" and (command.weapon_id == nil or command.aspect_id == nil) then
		error("Aspect training command requires weapon_id and aspect_id")
	end
end

local function write_result(command, status, message)
	local path = rom.path.combine(_PLUGIN.plugins_data_mod_folder_path, "result.txt")
	write_file(path, render_document({
		{ "schema", "neodes2-training-result-1" },
		{ "harness_version", HARNESS_VERSION },
		{ "session_nonce", session_nonce },
		{ "dataset_acquisition_id", config.dataset_acquisition_id },
		{ "command_id", command and command.command_id or "unknown" },
		{ "action", command and command.action or "unknown" },
		{ "status", status },
		{ "message", tostring(message):gsub("[\r\n=]", " ") },
		{ "weapon_id", current_weapon_id() or "unknown" },
		{ "aspect_id", select(1, current_aspect()) or "unknown" },
		{ "end", "neodes2-training-result-1" },
	}))
end

local function process_command(command)
	validate_command(command)
	if command.command_id == last_command_id then
		return
	end
	last_command_id = command.command_id
	local ok, message = pcall(function()
		if command.action == "aspect" then
			apply_aspect(command)
		else
			restore_original()
		end
	end)
	if ok then
		write_result(command, "ok", "applied")
		rom.log.info("NeonHades2 training command applied: " .. command.command_id)
	else
		write_result(command, "error", message)
		rom.log.warning("NeonHades2 training command failed: " .. tostring(message))
	end
end

local function poll_commands(active_generation)
	local arm_path = rom.path.combine(_PLUGIN.plugins_data_mod_folder_path, "arm.txt")
	local command_path = rom.path.combine(_PLUGIN.plugins_data_mod_folder_path, "command.txt")
	while game[GENERATION_KEY] == active_generation do
		game.wait(0.25)
		if not armed then
			local arm = parse_document(arm_path)
			if arm and arm.schema == "neodes2-training-arm-1" and arm["end"] == arm.schema and
				arm.session_nonce == session_nonce and arm.dataset_acquisition_id == config.dataset_acquisition_id then
				armed = true
				rom.log.info("NeonHades2 training harness armed for the current loaded save")
			end
		else
			local command = parse_document(command_path)
			if command then
				process_command(command)
			end
		end
	end
end

local function start_session()
	validate_config()
	local package_version = read_file(rom.path.combine(rom.paths.Content(), "packagever"))
	package_version = package_version and package_version:match("^%s*(.-)%s*$") or nil
	if package_version ~= config.package_version then
		error("Installed package version does not match the training config")
	end
	local active_generation = type(game[GENERATION_KEY]) == "number" and game[GENERATION_KEY] + 1 or 1
	game[GENERATION_KEY] = active_generation
	armed = false
	last_command_id = nil
	local aspect_id, aspect_rarity, had_aspect_trait = current_aspect()
	original_state = {
		weapon_id = current_weapon_id(),
		aspect_id = aspect_id,
		aspect_rarity = aspect_rarity,
		had_aspect_trait = had_aspect_trait,
		last_picked_trait_name = type(game.GameState) == "table" and game.GameState.LastPickedTraitName or nil,
	}
	if original_state.weapon_id == nil then
		error("Current training weapon is unavailable")
	end
	session_nonce = os.date("!%Y%m%dT%H%M%SZ") .. "-" .. tostring(os.time()) .. "-" ..
		tostring(os.clock()) .. "-" .. tostring({}):gsub("table: ", "")
	local ready_path = rom.path.combine(_PLUGIN.plugins_data_mod_folder_path, "ready.txt")
	write_file(ready_path, render_document({
		{ "schema", "neodes2-training-ready-1" },
		{ "harness_version", HARNESS_VERSION },
		{ "session_nonce", session_nonce },
		{ "dataset_acquisition_id", config.dataset_acquisition_id },
		{ "weapon_id", original_state.weapon_id },
		{ "aspect_id", original_state.aspect_id or "unknown" },
		{ "end", "neodes2-training-ready-1" },
	}))
	rom.log.info("NeonHades2 training harness ready and disarmed: " .. ready_path)
	game.thread(poll_commands, active_generation)
end

modutil.once_loaded.save(function()
	local ok, message = pcall(start_session)
	if not ok then
		armed = false
		pcall(function()
			rom.log.warning("NeonHades2 training harness could not start: " .. tostring(message))
		end)
	end
end)
