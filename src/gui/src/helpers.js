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

import get_html_element_from_options from './helpers/get_html_element_from_options.js';
import globToRegExp from './helpers/globToRegExp.js';
import item_icon from './helpers/item_icon.js';
import truncate_filename from './helpers/truncate_filename.js';
import update_title_based_on_uploads from './helpers/update_title_based_on_uploads.js';
import update_username_in_gui from './helpers/update_username_in_gui.js';
import mime from './lib/mime.js';
import path from './lib/path.js';
import UIAlert from './UI/UIAlert.js';
import UIItem from './UI/UIItem.js';
import UIWindowLogin from './UI/UIWindowLogin.js';
import UIWindowProgress from './UI/UIWindowProgress.js';

window.html_encode = (str) => {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#x27;');
};

window.html_decode = (str) => {
    if (typeof str !== 'string') return '';
    const txt = document.createElement('textarea');
    txt.innerHTML = str;
    return txt.value;
};

window.is_valid_domain = (domain) => {
    if (typeof domain !== 'string') return false;
    const re = /^(?!:\/\/)([a-zA-Z0-9-_]+\.)*[a-zA-Z0-9][a-zA-Z0-9-_]+\.[a-zA-Z]{2,11}?$/;
    return re.test(domain);
};

window.is_valid_email = (email) => {
    if (typeof email !== 'string') return false;
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
};

window.is_valid_username = (username) => {
    if (typeof username !== 'string') return false;
    const re = /^[a-zA-Z0-9_]{3,15}$/;
    return re.test(username);
};

window.is_valid_subdomain = (subdomain) => {
    if (typeof subdomain !== 'string') return false;
    const re = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
    return re.test(subdomain);
};

window.is_valid_app_name = (name) => {
    if (typeof name !== 'string') return false;
    const re = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
    return re.test(name);
};

window.format_bytes = (bytes, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

window.handle_same_name_exists = async ({
    action, parent_uuid,
}) => {
    try {
        await action({ overwrite: false });
        return true;
    } catch ( err ) {
        if ( err.code !== 'item_with_same_name_exists' ) {
            console.error(err);
            await UIAlert({
                message: err.message ?? 'Upload failed.',
                parent_uuid,
            });
            return false;
        }
        const alert_resp = await UIAlert({
            message: `<strong>${html_encode(err.entry_name)}</strong> already exists.`,
            buttons: [
                {\n                    label: i18n('replace'),
                    value: 'replace',
                    type: 'primary',
                },
                {
                    label: i18n('cancel'),
                    value: 'cancel',
                },
            ],
            parent_uuid,
        });
        if ( alert_resp === 'replace' ) {
            await action({ overwrite: true });
            return true;
        }
        return false;
    }
};
