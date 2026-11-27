"""Set up one Family Sink household through the Home Assistant UI."""

from homeassistant.config_entries import ConfigFlow
import probatio

from .const import DOMAIN


class FamilySinkConfigFlow(ConfigFlow, domain=DOMAIN):
    """A single entry adds the Family Sink sidebar panel."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Confirm creation of the household."""
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()
        if user_input is not None:
            return self.async_create_entry(title="Family Sink", data={})
        return self.async_show_form(step_id="user", data_schema=probatio.Schema({}))
