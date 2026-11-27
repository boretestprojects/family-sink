import React from "react";
import { createRoot } from "react-dom/client";
import { Dashboard } from "./Dashboard.jsx";

class FamilySinkPanel extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    const url = new URL("./panel.css", import.meta.url);
    url.search = new URL(import.meta.url).search;
    stylesheet.href = url.href;
    this.container = document.createElement("div");
    this.container.id = "root";
    shadow.append(stylesheet, this.container);
    this.call = (message) => this._hass.callWS(message);
    this.onMenu = () => this.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true }));
  }

  connectedCallback() {
    this.root = createRoot(this.container);
    this.render();
  }

  disconnectedCallback() {
    this.root?.unmount();
    this.root = null;
  }

  setProperties({ hass, narrow }) {
    if (hass !== undefined) this._hass = hass;
    if (narrow !== undefined) this._narrow = narrow;
    this.render();
  }

  set hass(hass) { this.setProperties({ hass }); }
  set narrow(narrow) { this.setProperties({ narrow }); }

  render() {
    if (this.root && this._hass) {
      this.root.render(<Dashboard hass={this._hass} narrow={this._narrow} call={this.call} onMenu={this.onMenu} />);
    }
  }
}

if (!customElements.get("family-sink-panel")) {
  // Document-scoped font faces resolve reliably inside the panel's shadow root.
  for (const { source, unicodeRange } of __FAMILY_SINK_MANROPE__) {
    document.fonts.add(new FontFace("Family Sink Manrope", source, {
      style: "normal", weight: "200 800", display: "swap", unicodeRange,
    }));
  }
  customElements.define("family-sink-panel", FamilySinkPanel);
}
