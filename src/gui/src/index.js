/**
 * Copyright (C) 2024-present Puter Technologies Inc.
 *
 * This file is part of Puter.
 *
 * Puter is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

window.puter_gui_enabled = true;

/**
 * Initializes and configures the GUI (Graphical User Interface) settings based on the provided options.
 *
 * The function sets global variables in the window object for various settings such as origins and domain names.
 * It also handles loading different resources depending on the environment (development or production).
 *
 * @param {Object} options - Configuration options to initialize the GUI.
 * @param {string} [options.gui_origin='https://puter.com'] - The origin URL for the GUI.
 * @param {string} [options.api_origin='https://api.puter.com'] - The origin URL for the API.
 * @param {number} [options.max_item_name_length=500] - Maximum allowed length for an item name.
 * @param {boolean} [options.local_dev_mode=false] - Flag indicating if local development mode is active.
 * @param {string} [options.local_dev_api_origin] - Origin URL for the local API.
 * @param {string} [options.local_dev_gui_origin] - Origin URL for the local GUI.
 */
window.init_puter_gui = function (options) {
    if (!options) {
        options = {};
    }

    // Set Default Values if not specified
    window.gui_origin = options.gui_origin || 'https://puter.com';
    window.api_origin = options.api_origin || 'https://api.puter.com';
    window.max_item_name_length = options.max_item_name_length || 500;
    window.local_dev_mode = options.local_dev_mode || false;
    window.local_dev_api_origin = options.local_dev_api_origin;
    window.local_dev_gui_origin = options.local_dev_gui_origin;

    // Derived variables
    window.puter_domain = window.gui_origin.split('://')[1];
    window.static_hosting_domain = 'puter.site';

    // If local dev mode is active, rewrite settings to match the local instance
    if (window.local_dev_mode) {
        window.api_origin = window.local_dev_api_origin;
        window.gui_origin = window.local_dev_gui_origin;
        window.puter_domain = window.gui_origin.split('://')[1];
        window.static_hosting_domain = 'puter.local';
    }
};

/**
* Dynamically loads an external JavaScript file.
* @param {string} url The URL of the external script to load.
* @returns {Promise} A promise that resolves once the script has loaded, or rejects on error.
*/
window.loadScript = async function (url) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;

        script.onload = () => {
            resolve();
        };

        script.onerror = () => {
            reject(new Error(`Failed to load script at url: ${url}`));
        };

        // Append the script to the body
        document.body.appendChild(script);
    });
};

/**
* Dynamically loads an external CSS file.
* @param {string} url The URL of the external CSS to load.
* @returns {Promise} A promise that resolves once the CSS has loaded, or rejects on error.
*/
window.loadCSS = async function (url) {
    return new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;

        link.onload = () => {
            resolve();
        };

        link.onerror = (error) => {
            reject(new Error(`Failed to load CSS at url: ${url}`));
        };

        document.head.appendChild(link);
    });
};

console.log(
    "%c⚠️Warning⚠️\\n%cPlease refrain from adding or pasting any sort of code here, as doing so could potentially compromise your account. \\nYou don't get what you intended anyway, but the hacker will! \\n\\n%cFor further information please visit https://developer.chrome.com/blog/self-xss",
    "color:red; font-size:2rem; display:block; margin-left:0; margin-bottom: 20px; background: black; width: 100%; margin-top:20px; font-family: 'Helvetica Neue', HelveticaNeue, Helvetica, Arial, sans-serif;",
    "font-size:1rem; font-family: 'Helvetica Neue', HelveticaNeue, Helvetica, Arial, sans-serif; color: black;",
    "font-size:1rem; font-family: 'Helvetica Neue', HelveticaNeue, Helvetica, Arial, sans-serif; color: #0d6efd;"
);
