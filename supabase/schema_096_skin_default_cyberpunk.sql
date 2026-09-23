-- Cyberpunk is the default theme; Simple is the opt-out in Settings.
alter table nova_preferences alter column skin set default 'cyberpunk';
update nova_preferences set skin = 'cyberpunk' where skin = 'simple';
