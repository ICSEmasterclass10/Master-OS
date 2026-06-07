let source_path;
let apps = [];
let sortBy = 'created_at';
let sortDirection = 'desc';
let currently_editing_app;
let dropped_items;
let search_query;
let originalValues = {};

const APP_CATEGORIES = [
    { id: 'games', label: 'Games' },
    { id: 'developer-tools', label: 'Developer Tools' },
    { id: 'photo-video', label: 'Photo & Video' },
    { id: 'productivity', label: 'Productivity' },
    { id: 'utilities', label: 'Utilities' },
    { id: 'education', label: 'Education' },
    { id: 'business', label: 'Business' },
    { id: 'social', label: 'Social' },
    { id: 'graphics-design', label: 'Graphics & Design' },
    { id: 'music-audio', label: 'Music & Audio' },
    { id: 'news', label: 'News' },
    { id: 'entertainment', label: 'Entertainment' },
    { id: 'finance', label: 'Finance' },
    { id: 'health-fitness', label: 'Health & Fitness' },
    { id: 'lifestyle', label: 'Lifestyle' },
];

const PREVIEW_DEVICES = [
    { id: 'desktop', label: 'Desktop' },
    { id: 'tablet', label: 'Tablet' },
    { id: 'mobile', label: 'Mobile' },
];

async function init_apps () {
    setTimeout(async function () {
        puter.ui.onLaunchedWithItems(async function (items) {
            source_path = items[0].path;
            // if source_path is provided, this means that the user is creating a new app/updating an existing app
            // by deploying an existing Puter folder. So we create the app and deploy it.
            if ( source_path ) {
                // todo if there are no apps, go straight to creating a new app
                $('.insta-deploy-modal').get(0).showModal();
                // set item name
                $('.insta-deploy-item-name').html(html_encode(items[0].name));
            }
        });

        // Get apps
        puter.apps.list({ icon_size: 64 }).then((resp) => {
            apps = resp;

            // hide loading
            puter.ui.hideSpinner();

            // set apps
            if ( apps.length > 0 ) {
                if ( window.activeTab === 'apps' ) {
                    $('#no-apps-notice').hide();
                    $('#app-list').show();
                }
                $('.app-card').remove();
                apps.forEach(app => {
                    $('#app-list-table > tbody').append(generate_app_card(app));
                });
                count_apps();
                sort_apps();
                activate_tippy();
            } else {
                $('#no-apps-notice').show();
            }
        });
    }, 1000);
}

/**
 * Refreshes the list of apps in the UI.
 *
 * @param {boolean} [show_loading=false] - Whether to show a loading indicator while refreshing.
 *
 */
window.refresh_app_list = (show_loading = false) => {
    if ( show_loading ) {
        puter.ui.showSpinner();
    }
    // get apps
    setTimeout(function () {
        // uncheck the select all checkbox
        $('.select-all-apps').prop('checked', false);

        puter.apps.list({ icon_size: 64 }).then((apps_res) => {
            puter.ui.hideSpinner();
            apps = apps_res;
            if ( apps.length > 0 ) {
                if ( window.activeTab === 'apps' ) {
                    $('#no-apps-notice').hide();
                    $('#app-list').show();
                }
                $('.app-card').remove();
                apps.forEach(app => {
                    $('#app-list-table > tbody').append(generate_app_card(app));
                });
                count_apps();
                sort_apps();
            } else {
                $('#no-apps-notice').show();
                $('#app-list').hide();
            }
            activate_tippy();
            puter.ui.hideSpinner();
        });
    }, show_loading ? 1000 : 0);
};

$(document).on('click', '.create-an-app-btn', async function (e) {
    let title = await puter.ui.prompt('Please enter a title for your app:', 'My Awesome App');

    if ( title.length > 60 ) {
        puter.ui.alert('Title cannot be longer than 60.', [
            {
                label: 'Ok',
            },
        ]);
        return;
    }
    else if ( title ) {
        create_app(title);
    }
});

if ( ! (await puter.auth.getUser()).hasDevAccountAccess ) $('.setup-account-btn').hide();
$('.setup-account-btn').on('click', async () => {
    await puter.ui.openDevPaymentsAccount();
});

async function create_app (title, source_path = null, items = null) {
    // name
    let name = slugify(title, {
        lower: true,
        strict: true,
    });

    // icon
    let icon = await getBase64ImageFromUrl('./img/app.svg');

    // open the 'Creating new app...' modal
    let start_ts = Date.now();

    puter.ui.showSpinner();

    //----------------------------------------------------
    // Create app
    //----------------------------------------------------
    puter.apps.create({
        title: title,
        name: name,
        indexURL: 'https://dev-center.puter.com/coming-soon.html',
        icon: icon,
        description: ' ',
        maximizeOnStart: false,
        background: false,
        dedupeName: true,
        metadata: {
            window_resizable: true,
            fullpage_on_landing: true,
        },
    })
        .then(async (app) => {
            let app_dir;
            // ----------------------------------------------------
            // Create app directory in AppData
            // ----------------------------------------------------
            app_dir = await puter.fs.mkdir(`/${auth_username}/AppData/${dev_center_uid}/${app.uid}`,
                            { overwrite: true, recursive: true, rename: false });
            // ----------------------------------------------------
            // Create a router for the app with a fresh hostname
            // ----------------------------------------------------
            let subdomain = `${name}-${Math.random().toString(36).substring(2)}`;
            await puter.hosting.create(subdomain, app_dir.path);

            // ----------------------------------------------------
            // Update the app with the new hostname
            // ----------------------------------------------------
            puter.apps.update(app.name, {
                title: title,
                indexURL: source_path ? `${protocol}://${subdomain}.${static_hosting_domain}` : 'https://dev-center.puter.com/coming-soon.html',
                icon: icon,
                description: ' ',
                maximizeOnStart: false,
                background: false,
                metadata: {
                    category: null, // default category on creation
                    window_resizable: true,
                    fullpage_on_landing: true,
                },
            }).then(async (app) => {
                // refresh app list
                puter.apps.list({ icon_size: 64 }).then(async (resp) => {
                    apps = resp;
                    setTimeout(() => {
                        // open edit app section
                        edit_app_section(app.name);

                        // set drop area if source_path was provided or items were dropped
                        if ( source_path || items ) {
                            $('.drop-area').removeClass('drop-area-hover');
                            $('.drop-area').addClass('drop-area-ready-to-deploy');
                        }
                        puter.ui.hideSpinner();
                        // deploy app if source_path was provided
                        if ( source_path ) {
                            deploy(app, source_path);
                        } else if ( items ) {
                            deploy(app, items);
                        }
                        activate_tippy();
                    }, (Date.now() - start_ts) > 2000 ? 1 : 2000 - (Date.now() - start_ts));
                });
            }).catch(async (err) => {
                console.log(err);
            });
            // ----------------------------------------------------
            // Create a "shortcut" on the desktop
            // ----------------------------------------------------
            puter.fs.upload(new File([], app.title),
                            `/${auth_username}/Desktop`,
                            {
                                name: app.title,
                                dedupeName: true,
                                overwrite: false,
                                appUID: app.uid,
                            });
            //----------------------------------------------------
            // Increment app count
            //----------------------------------------------------
            $('.app-count').html(parseInt($('.app-count').html() ?? 0) + 1);

        }).catch(async (err) => {
            $('#create-app-error').show();
            $('#create-app-error').html(err.message);
            document.body.scrollTop = document.documentElement.scrollTop = 0;
        });
}

$(document).on('click', '.deploy-btn', function (e) {
    const $activeCard = $('.deploy-app-card.deploy-app-active');
    if ( $activeCard.hasClass('deploy-app-card-files') ) {
        deploy(currently_editing_app, dropped_items);
    } else if ( $activeCard.hasClass('deploy-app-card-link') ) {
        saveEditedApp('deploy-app-index-url');
    }
});

$(document).on('click', '.edit-app, .go-to-edit-app', function (e) {
    const cur_app_name = $(this).attr('data-app-name');
    edit_app_section(cur_app_name);
});

$(document).on('click', '.delete-app', async function (e) {
});

$(document).on('click', '.deploy-app-card', function () {
    if ( $(this).hasClass('deploy-app-active') ) {
        return;
    }
    $('.deploy-btn').addClass('disabled');
    if ( $(this).hasClass('deploy-app-card-files') ) {
        $('#deploy-app-index-url').val('');
    }
    if ( $(this).hasClass('deploy-app-card-link') ) {
        reset_drop_area();
        if ( $('#deploy-app-index-url').val() != '' ) {
            $('.deploy-btn').removeClass('disabled');
        }
    }
    $('.deploy-app-card').removeClass('deploy-app-active');
    $(this)
        .addClass('deploy-app-active')
        .find('input[type="radio"]')
        .prop('checked', true);
});

$(document).on('input change', '#deploy-app-index-url', () => {
    $('.deploy-btn').removeClass('disabled');
});

// generate app link
function applink (app) {
    return `${protocol}://${domain}${port ? `:${port}` : ''}/app/${app.name}`;
}

/**
 * Generates the HTML for the app editing section.
 *
 * @param {Object} app - The app object containing details of the app to be edited.
 * @returns {string} HTML string for the app editing section.
 */
function generate_edit_app_section (app) {
    if ( app.result ) {
        app = app.result;
    }

    let maximize_on_start = app.maximize_on_start ? 'checked' : '';

    let h = '';
    h += `
        <div class="edit-app-navbar">
            <div style="flex-grow:1;">
                <img class="app-icon" data-uid="${html_encode(app.uid)}" src="${html_encode(!app.icon ? './img/app.svg' : app.icon)}">
                <h3 class="app-title" data-uid="${html_encode(app.uid)}">${html_encode(app.title)}${app.metadata?.locked ? lock_svg_tippy : ''}</h3>
                <div style="margin-top: 4px; margin-bottom: 4px;">
                    <span class="open-app-btn" data-app-uid="${html_encode(app.uid)}" data-app-name="${html_encode(app.name)}">Open</span>
                    <span style="margin: 5px; opacity: 0.3;">&bull;</span>
                    <span class="add-app-to-desktop" data-app-uid="${html_encode(app.uid)}" data-app-title="${html_encode(app.title)}">Add Shortcut to Desktop</span>
                    <span style="margin: 5px; opacity: 0.3;">&bull;</span>
                    <span title="Delete app" class="delete-app-settings" data-app-name="${html_encode(app.name)}" data-app-title="${html_encode(app.title)}" data-app-uid="${html_encode(app.uid)}">Delete</span>
                </div>
                <a class="app-url" target="_blank" data-uid="${html_encode(app.uid)}" href="${html_encode(applink(app))}">${html_encode(applink(app))}</a>
            </div>
            <button class="back-to-main-btn button button-default">Back</button>
        </div>

        <ul class="section-tab-buttons disable-user-select">
            <li class="section-tab-btn active" data-tab="deploy"><span>Deploy</span></li>
            <li class="section-tab-btn" data-tab="info"><span>Settings</span></li>
            <li class="section-tab-btn" data-tab="analytics"><span>Analytics</span></li>
        </ul>

        <div class="section-tab active" data-tab="deploy">
            <div class="error" id="deploy-app-error" style="margin-bottom: 25px;"></div>
            <div class="success deploy-success-msg">
                New version deployed successfully 🎉<span class="close-success-msg">&times;</span>
                <p style="margin-bottom:0;"><span class="open-app button button-action" data-uid="${html_encode(app.uid)}" data-app-name="${html_encode(app.name)}">Give it a try!</span></p>
            </div>
           <div class="deploy-app-card-container">

               <div class="deploy-app-card deploy-app-card-files deploy-app-active" >
                 <div class="deploy-app-card-header">
                   <div>
                     <h3>Use files</h3>
                     <p>Upload and deploy static assets like HTML, CSS, and JavaScript directly to host your app.</p>
                   </div>
                   <input type="radio" name="deploy-app-card-mode" checked />
                 </div>
                 <div class="drop-area disable-user-select">${drop_area_placeholder}</div>
               </div>

               <div class="deploy-app-card-or">OR</div>

               <div class="deploy-app-card deploy-app-card-link" >
                 <div class="deploy-app-card-header">
                   <div>
                     <h3>Use link</h3>
                     <p>Set the app’s index to any publicly accessible URL where your app is already deployed.</p>
                   </div>
                   <input type="radio" name="deploy-app-card-mode" />
                 </div>
                 <input type="text" id="deploy-app-index-url" placeholder="Add your link" value="${html_encode(app.index_url)}" />
               </div>
                 <button class="deploy-btn disable-user-select button button-primary disabled">Deploy Now</button>
             </div>
        </div>

        <div class="section-tab" data-tab="info">
            <form style="clear:both; padding-bottom: 50px;">
                <div class="error" id="edit-app-error"></div>
                <div class="success" id="edit-app-success">App has been successfully updated.<span class="close-success-msg">&times;</span>
                <p style="margin-bottom:0;"><span class="open-app button button-action" data-uid="${html_encode(app.uid)}" data-app-name="${html_encode(app.name)}">Give it a try!</span></p>
                </div>
                <input type="hidden" id="edit-app-uid" value="${html_encode(app.uid)}">

                <h3 style="font-size: 23px; border-bottom: 1px solid #EEE; margin-top: 40px;">Basic</h3>
                <label for="edit-app-title">Title</label>
                <input type="text" id="edit-app-title" placeholder="My Awesome App!" value="${html_encode(app.title)}">

                <label for="edit-app-name">Name</label>
                <input type="text" id="edit-app-name" placeholder="my-awesome-app" style="font-family: monospace;" value="${html_encode(app.name)}">

                <label for="edit-app-index-url">Index URL</label>
                <input type="text" id="edit-app-index-url" placeholder="https://example-app.com/index.html" value="${html_encode(app.index_url)}">
                
                <label for="edit-app-app-id">App ID</label>
                <div style="overflow:hidden;">
                    <input type="text" style="width: 362px; float:left;" class="app-uid" value="${html_encode(app.uid)}" readonly><span class="copy-app-uid" style="cursor: pointer; height: 35px; display: inline-block; width: 50px; text-align: center; line-height: 35px; margin-left:5px;">${copy_svg}</span>
                </div>

                <label for="edit-app-icon">Icon</label>
                <div id="edit-app-icon" style="background-image:url(${!app.icon ? './img/app.svg' : html_encode(app.icon)});" ${app.icon ? `data-url="${html_encode(app.icon)}"` : ''}  ${app.icon ? `data-base64="${html_encode(app.icon)}"` : ''} >
                    <div id="change-app-icon">Change App Icon</div>
                </div>
                <span id="edit-app-icon-delete" style="${app.icon ? 'display:block;' : ''}">Remove icon</span>

                ${generateSocialImageSection(app)}
                ${generatePreviewImagesSection()}
                <label for="edit-app-description">Description</label>
                <textarea id="edit-app-description">${html_encode(app.description)}</textarea>
                
                <label for="edit-app-category">Category</label>
                <select id="edit-app-category" class="category-select">
                    <option value="">Select a category</option>
                    ${APP_CATEGORIES.map(category =>
                        `<option value="${html_encode(category.id)}" ${app.metadata?.category === category.id ? 'selected' : ''}>${html_encode(category.label)}</option>`).join('')}
                </select>

                <label for="edit-app-filetype-associations">File Associations</label>
               <p style="margin-top: 10px; font-size:13px;">A list of file type specifiers. For example if you include <code>.txt</code> your apps could be opened when a user clicks on a TXT file.</p>
               <p style="margin-top: 5px; font-size:13px;">You can paste multiple extensions at once (comma, space, or tab separated) or press comma to add each extension.</p>
               <textarea id="edit-app-filetype-associations"  placeholder="Paste multiple extensions like: .txt, .doc, .pdf, application/json">${JSON.stringify(app.filetype_associations.map(item => ({ 'value': item })), null, app.filetype_associations.length).replace(/</g, '\\u003c')}</textarea>

                <h3 style="font-size: 23px; border-bottom: 1px solid #EEE; margin-top: 50px; margin-bottom: 0px;">Window</h3>
                <div>
                    <input type="checkbox" id="edit-app-background" name="edit-app-background" value="true" style="margin-top:30px;" ${app.background ? 'checked' : ''}>
                    <label for="edit-app-background" style="display: inline;">Run as a background process.</label>
                </div>

                <div>
                    <input type="checkbox" id="edit-app-fullpage-on-landing" name="edit-app-fullpage-on-landing" value="true" style="margin-top:30px;" ${app.metadata?.fullpage_on_landing ? 'checked' : ''} ${app.background ? 'disabled' : ''}>
                    <label for="edit-app-fullpage-on-landing" style="display: inline;">Load in full-page mode when a user lands directly on this app.</label>
                </div>

                <div>
                    <input type="checkbox" id="edit-app-maximize-on-start" name="edit-app-maximize-on-start" value="true" style="margin-top:30px;" ${maximize_on_start ? 'checked' : ''} ${app.background ? 'disabled' : ''}>
                    <label for="edit-app-maximize-on-start" style="display: inline;">Maximize window on start</label>
                </div>
                
                <div>
                    <label for="edit-app-window-width">Initial window width</label>
                    <input type="number" id="edit-app-window-width" placeholder="680" value="${html_encode(app.metadata?.window_size?.width ?? 680)}" style="width:200px;" ${maximize_on_start || app.background ? 'disabled' : ''}>
                    <label for="edit-app-window-height">Initial window height</label>
                    <input type="number" id="edit-app-window-height" placeholder="380" value="${html_encode(app.metadata?.window_size?.height ?? 380)}" style="width:200px;" ${maximize_on_start || app.background ? 'disabled' : ''}>
                </div>

                <div style="margin-top:30px;">
                    <label for="edit-app-window-top">Initial window top</label>
                    <input type="number" id="edit-app-window-top" placeholder="100" value="${app.metadata?.window_position?.top ? html_encode(app.metadata.window_position.top) : ''}" style="width:200px;" ${maximize_on_start || app.background ? 'disabled' : ''}>
                    <label for="edit-app-window-left">Initial window left</label>
                    <input type="number" id="edit-app-window-left" placeholder="100" value="${app.metadata?.window_position?.left ? html_encode(app.metadata.window_position.left) : ''}" style="width:200px;" ${maximize_on_start || app.background ? 'disabled' : ''}>
                </div>

                <div style="margin-top:30px;">
                    <input type="checkbox" id="edit-app-window-resizable" name="edit-app-window-resizable" value="true" ${app.metadata?.window_resizable ? 'checked' : ''} ${app.background ? 'disabled' : ''}>
                    <label for="edit-app-window-resizable" style="display: inline;">Resizable window</label>
                </div>

                <div style="margin-top:30px;">
                    <input type="checkbox" id="edit-app-hide-titlebar" name="edit-app-hide-titlebar" value="true" ${app.metadata?.hide_titlebar ? 'checked' : ''} ${app.background ? 'disabled' : ''}>
                    <label for="edit-app-hide-titlebar" style="display: inline;">Hide window titlebar</label>
                </div>

                <div style="margin-top:30px;">
                    <input type="checkbox" id="edit-app-set-title-to-file" name="edit-app-set-title-to-file" value="true" ${app.metadata?.set_title_to_opened_file ? 'checked' : ''} ${app.background ? 'disabled' : ''}>
                    <label for="edit-app-set-title-to-file" style="display: inline;">Automatically set window title to opened file's name</label>
                    <p>This will set your app's window title to the opened file's name when a user opens a file in your app.</p>
                </div>

                <h3 style="font-size: 23px; border-bottom: 1px solid #EEE; margin-top: 50px; margin-bottom: 0px;">Misc</h3>
                <div style="margin-top:30px;">
                    <input type="checkbox" id="edit-app-locked" name="edit-app-locked" value="true" ${app.metadata?.locked ? 'checked' : ''}>
                    <label for="edit-app-locked" style="display: inline;">Delete Protection${lock_svg}</label>
                    <p>When enabled, the app cannot be deleted. This is useful for preventing accidental deletion of important apps.</p>
                </div>

                <div style="z-index: 999; box-shadow: 10px 10px 15px #8c8c8c; overflow: hidden; position: fixed; bottom: 0; background: white; padding: 10px; width: 100%; left: 0;">
                    <button type="button" class="edit-app-save-btn button button-primary" style="margin-right: 40px;">Save</button>
                    <button type="button" class="edit-app-reset-btn button button-secondary">Reset</button>
                </div>
            </form>
        </div>
        <div class="section-tab" data-tab="analytics">
            <label for="analytics-period">Period</label>
            <select id="analytics-period" class="category-select">
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <optgroup label="──────"></optgroup>
                <option value="this_week">This week</option>
                <option value="last_week">Last week</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <optgroup label="──────"></optgroup>
                <option value="this_month">This month</option>
                <option value="last_month">Last month</option>
                <optgroup label="──────"></optgroup>
                <option value="this_year">This year</option>
                <option value="last_year">Last year</option>
                <optgroup label="──────"></optgroup>
                <option value="12m">Last 12 months</option>
                <option value="all">All time</option>
            </select>
            <div style="overflow:hidden;">
                <div class="analytics-card" id="analytics-users">
                    <h3 style="margin-top:0;">Users</h3>
                    <div class="count" style="font-size: 35px;"></div>
                </div>
                <div class="analytics-card" id="analytics-opens">
                    <h3 style="margin-top:0;">Opens</h3>
                    <div class="count" style="font-size: 35px;"></div>
                </div>
            </div>
            <hr style="margin-top: 50px;">
            <p>Timezone: UTC</p>
            <p>More analytics features coming soon...</p>
        </div>
    `;
    return h;
}

/* This function keeps track of the original values of the app before it is edited*/
function trackOriginalValues () {
    originalValues = {
        title: $('#edit-app-title').val(),
        name: $('#edit-app-name').val(),
        indexURL: $('#edit-app-index-url').val(),
        description: $('#edit-app-description').val(),
        icon: $('#edit-app-icon').attr('data-base64'),
        fileAssociations: $('#edit-app-filetype-associations').val(),
        category: $('#edit-app-category').val(),
        socialImage: $('#edit-app-social-image').attr('data-base64'),
        previewImages: getPreviewImagesState(),
        windowSettings: {
            width: $('#edit-app-window-width').val(),
            height: $('#edit-app-window-height').val(),
            top: $('#edit-app-window-top').val(),
            left: $('#edit-app-window-left').val(),
        },
        checkboxes: {
            maximizeOnStart: $('#edit-app-maximize-on-start').is(':checked'),
            background: $('#edit-app-background').is(':checked'),
            resizableWindow: $('#edit-app-window-resizable').is(':checked'),
            hideTitleBar: $('#edit-app-hide-titlebar').is(':checked'),
            locked: $('#edit-app-locked').is(':checked'),
            fullPageOnLanding: $('#edit-app-fullpage-on-landing').is(':checked'),
            setTitleToFile: $('#edit-app-set-title-to-file').is(':checked'),
        },
    };
}

/* This function compares for all fields and checks if anything has changed from before editing*/
function hasChanges () {
    // is icon changed
    if ( $('#edit-app-icon').attr('data-base64') !== originalValues.icon ) {
        return true;
    }

    // if social image is changed
    if ( $('#edit-app-social-image').attr('data-base64') !== originalValues.socialImage ) {
        return true;
    }

    if ( serializePreviewState(getPreviewImagesState()) !== serializePreviewState(originalValues.previewImages) ) {
        return true;
    }

    // if any of the fields have changed
    return (
        $('#edit-app-title').val() !== originalValues.title ||
        $('#edit-app-name').val() !== originalValues.name ||
        $('#edit-app-index-url').val() !== originalValues.indexURL ||
        $('#edit-app-description').val() !== originalValues.description ||
        $('#edit-app-icon').attr('data-base64') !== originalValues.icon ||
        $('#edit-app-filetype-associations').val() !== originalValues.fileAssociations ||
        $('#edit-app-category').val() !== originalValues.category ||
        $('#edit-app-social-image').attr('data-base64') !== originalValues.socialImage ||
        $('#edit-app-window-width').val() !== originalValues.windowSettings.width ||
        $('#edit-app-window-height').val() !== originalValues.windowSettings.height ||
        $('#edit-app-window-top').val() !== originalValues.windowSettings.top ||
        $('#edit-app-window-left').val() !== originalValues.windowSettings.left ||
        $('#edit-app-maximize-on-start').is(':checked') !== originalValues.checkboxes.maximizeOnStart ||
        $('#edit-app-background').is(':checked') !== originalValues.checkboxes.background ||
        $('#edit-app-window-resizable').is(':checked') !== originalValues.checkboxes.resizableWindow ||
        $('#edit-app-hide-titlebar').is(':checked') !== originalValues.checkboxes.hideTitleBar ||
        $('#edit-app-locked').is(':checked') !== originalValues.checkboxes.locked ||
        $('#edit-app-fullpage-on-landing').is(':checked') !== originalValues.checkboxes.fullPageOnLanding ||
        $('#edit-app-set-title-to-file').is(':checked') !== originalValues.checkboxes.setTitleToFile
    );
}

/* This function enables or disables the save button if there are any changes made */
function toggleSaveButton () {
    if ( hasChanges() ) {
        $('.edit-app-save-btn').prop('disabled', false);
    } else {
        $('.edit-app-save-btn').prop('disabled', true);
    }
}

/* This function enables or disables the reset button if there are any changes made */
function toggleResetButton () {
    if ( hasChanges() ) {
        $('.edit-app-reset-btn').prop('disabled', false);
    } else {
        $('.edit-app-reset-btn').prop('disabled', true);
    }
}

window.reset_drop_area = () => {
    dropped_items = null;
    $('.drop-area').html(drop_area_placeholder);
    $('.drop-area').removeClass('drop-area-ready-to-deploy');
    $('.deploy-btn').addClass('disabled');
};

/* This function reverts the changes made back to the original values of the edit form */
function resetToOriginalValues () {
    $('#edit-app-title').val(originalValues.title);
    $('#edit-app-name').val(originalValues.name);
    $('#edit-app-index-url').val(originalValues.indexURL);
    $('#edit-app-description').val(originalValues.description);
    $('#edit-app-filetype-associations').val(originalValues.fileAssociations);
    $('#edit-app-category').val(originalValues.category);
    $('#edit-app-window-width').val(originalValues.windowSettings.width);
    $('#edit-app-window-height').val(originalValues.windowSettings.height);
    $('#edit-app-window-top').val(originalValues.windowSettings.top);
    $('#edit-app-window-left').val(originalValues.windowSettings.left);
    $('#edit-app-maximize-on-start').prop('checked', originalValues.checkboxes.maximizeOnStart);
    $('#edit-app-background').prop('checked', originalValues.checkboxes.background);
    $('#edit-app-window-resizable').prop('checked', originalValues.checkboxes.resizableWindow);
    $('#edit-app-hide-titlebar').prop('checked', originalValues.checkboxes.hideTitleBar);
    $('#edit-app-locked').prop('checked', originalValues.checkboxes.locked);
    $('#edit-app-fullpage-on-landing').prop('checked', originalValues.checkboxes.fullPageOnLanding);
    $('#edit-app-set-title-to-file').prop('checked', originalValues.checkboxes.setTitleToFile);

    if ( originalValues.icon ) {
        $('#edit-app-icon').css('background-image', `url(${originalValues.icon})`);
        $('#edit-app-icon').attr('data-url', originalValues.icon);
        $('#edit-app-icon').attr('data-base64', originalValues.icon);
        $('#edit-app-icon-delete').show();
    } else {
        $('#edit-app-icon').css('background-image', '');
        $('#edit-app-icon').removeAttr('data-url');
        $('#edit-app-icon').removeAttr('data-base64');
        $('#edit-app-icon-delete').hide();
    }

    if ( originalValues.socialImage ) {
        $('#edit-app-social-image').css('background-image', `url(${originalValues.socialImage})`);
        $('#edit-app-social-image').attr('data-url', originalValues.socialImage);
        $('#edit-app-social-image').attr('data-base64', originalValues.socialImage);
    } else {
        $('#edit-app-social-image').css('background-image', '');
        $('#edit-app-social-image').removeAttr('data-url');
        $('#edit-app-social-image').removeAttr('data-base64');
    }

    applyPreviewImages(originalValues.previewImages);
}

async function edit_app_section (cur_app_name, tab = 'deploy') {
    puter.ui.showSpinner();

    $('section:not(.sidebar)').hide();
    $('.tab-btn').removeClass('active');
    $('.tab-btn[data-tab="apps"]').addClass('active');

    let cur_app = await puter.apps.get(cur_app_name, { icon_size: 128, stats_period: 'today' });

    currently_editing_app = cur_app;

    // generate edit app section
    $('#edit-app').html(generate_edit_app_section(cur_app));
    applyPreviewImages(cur_app.metadata?.preview_images);
    trackOriginalValues(); // Track initial field values
    toggleSaveButton(); // Ensure Save button is initially disabled
    toggleResetButton(); // Ensure Reset button is initially disabled
    $('#edit-app').show();

    // analytics
    $('#analytics-users .count').html(cur_app.stats.user_count);
    $('#analytics-opens .count').html(cur_app.stats.open_count);

    render_analytics('today');

    // show the correct tab
    $('.section-tab').hide();
    $(`.section-tab[data-tab="${tab}"]`).show();
    $('.section-tab-buttons .section-tab-btn').removeClass('active');
    $(`.section-tab-buttons .section-tab-btn[data-tab="${tab}"]`).addClass('active');

    const filetype_association_input = document.querySelector('textarea[id=edit-app-filetype-associations]');
    let tagify = new Tagify(filetype_association_input, {
        pattern: /\.(?:[a-z0-9]+)|(?:[a-z]+\/(?:[a-z0-9.-]+|\*))/,
        delimiters: ',', // Use comma as delimiter
        duplicates: false, // Prevent duplicate tags
        enforceWhitelist: false,
        dropdown: {
            enabled: 0,
        },
        whitelist: [
            'text/*', 'image/*', 'audio/*', 'video/*', 'application/*',
            '.doc', '.docx', '.pdf', '.txt', '.odt', '.rtf', '.tex', '.md', '.pages', '.epub', '.mobi', '.azw', '.azw3', '.djvu', '.xps', '.oxps', '.fb2', '.textile', '.markdown', '.asciidoc', '.rst', '.wpd', '.wps', '.abw', '.zabw',
            '.xls', '.xlsx', '.csv', '.ods', '.numbers', '.tsv', '.gnumeric', '.xlt', '.xltx', '.xlsm', '.xltm', '.xlam', '.xlsb',
            '.ppt', '.pptx', '.key', '.odp', '.pps', '.ppsx', '.pptm', '.potx', '.potm', '.ppam',
            '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif', '.svg', '.webp', '.ico', '.psd', '.ai', '.eps', '.raw', '.cr2', '.nef', '.orf', '.sr2', '.heic', '.heif', '.avif', '.jxr', '.hdp', '.wdp', '.jng', '.xcf', '.pgm', '.pbm', '.ppm', '.pnm',
            '.mp4', '.avi', '.mov', '.wmv', '.mkv', '.flv', '.webm', '.m4v', '.mpeg', '.mpg', '.3gp', '.3g2', '.ogv', '.vob', '.drc', '.gifv', '.mng', '.qt', '.yuv', '.rm', '.rmvb', '.asf', '.amv', '.m2v', '.svi',
            '.mp3', '.wav', '.aac', '.flac', '.ogg', '.m4a', '.wma', '.aiff', '.alac', '.ape', '.au', '.mid', '.midi', '.mka', '.pcm', '.ra', '.ram', '.snd', '.wv', '.opus',
            '.js', '.ts', '.html', '.css', '.json', '.xml', '.php', '.py', '.java', '.cpp', '.c', '.cs', '.h', '.hpp', '.hxx', '.rs', '.go', '.rb', '.pl', '.swift', '.kt', '.kts', '.scala', '.coffee', '.sass', '.scss', '.less', '.jsx', '.tsx', '.vue', '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd', '.sql', '.r', '.dart', '.f', '.f90', '.for', '.lua', '.m', '.mm', '.clj', '.erl', '.ex', '.exs', '.elm', '.hs', '.lhs', '.lisp', '.ml', '.mli', '.nim', '.pl', '.rkt', '.v', '.vhd',
            '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.z', '.lz', '.lzma', '.tlz', '.txz', '.tgz', '.tbz2', '.bz', '.br', '.lzo', '.ar', '.cpio', '.shar', '.lrz', '.lz4', '.lz2', '.rz', '.sfark', '.sz', '.zoo',
            '.db', '.sql', '.sqlite', '.sqlite3', '.dbf', '.mdb', '.accdb', '.db3', '.s3db', '.dbx',
            '.ttf', '.otf', '.woff', '.woff2', '.eot', '.pfa', '.pfb', '.sfd',
            '.dwg', '.dxf', '.stl', '.obj', '.fbx', '.dae', '.3ds', '.blend', '.max', '.ma', '.mb', '.c4d', '.skp', '.usd', '.usda', '.usdc', '.abc',
            '.mat', '.fig', '.nb', '.cdf', '.fits', '.fts', '.fit', '.gmsh', '.msh', '.fem', '.neu', '.hdf', '.h5', '.nx', '.unv',
            '.exe', '.dll', '.so', '.dylib', '.app', '.dmg', '.iso', '.img', '.bin', '.msi', '.apk', '.ipa', '.deb', '.rpm',
            '.directory',
        ],
    });

    // --------------------------------------------------------
    // Dragster
    // --------------------------------------------------------
    let drop_area_content = drop_area_placeholder;
    $('.drop-area').dragster({
        enter: function (dragsterEvent, event) {
            drop_area_content = $('.drop-area').html();
            $('.drop-area').addClass('drop-area-hover');
            $('.drop-area').html(drop_area_placeholder);
        },
        leave: function (dragsterEvent, event) {
            $('.drop-area').html(drop_area_content);
            $('.drop-area').removeClass('drop-area-hover');
        },
        drop: async function (dragsterEvent, event) {
            const e = event.originalEvent;
            e.stopPropagation();
            e.preventDefault();
            // hide previous success message
            $('.deploy-success-msg').fadeOut();
            // remove hover class
            $('.drop-area').removeClass('drop-area-hover');
            //----------------------------------------------------
            // Puter items dropped
            //----------------------------------------------------
            if ( e.detail?.items?.length > 0 ) {
                let items = e.detail.items;
                // ----------------------------------------------------
                // One Puter file dropped
                // ----------------------------------------------------
                if ( items.length === 1 && !items[0].isDirectory ) {
                    if ( items[0].name.toLowerCase() === 'index.html' ) {
                        dropped_items = items[0].path;
                        $('.drop-area').removeClass('drop-area-hover');
                        $('.drop-area').addClass('drop-area-ready-to-deploy');
                        drop_area_content = '<p style="margin-bottom:0; font-weight: 500;">index.html</p><p>Ready to deploy 🚀</p><p class="reset-deploy"><span>Cancel</span></p>';
                        $('.drop-area').html(drop_area_content);
                        // enable deploy button
                        $('.deploy-btn').removeClass('disabled');
                    } else {
                        puter.ui.alert('You need to have an index.html file in your deployment.', [
                            {
                                label: 'Ok',
                            },
                        ]);
                        $('.drop-area').removeClass('drop-area-ready-to-deploy');
                        $('.deploy-btn').addClass('disabled');
                        dropped_items = [];
                    }
                    return;
                }
                // ----------------------------------------------------
                // Multiple Puter files dropped
                // ----------------------------------------------------
                else if ( items.length > 1 ) {
                    let hasIndexHtml = false;
                    for ( let item of items ) {
                        if ( item.name.toLowerCase() === 'index.html' ) {
                            hasIndexHtml = true;
                            break;
                        }
                    }

                    if ( hasIndexHtml ) {
                        dropped_items = items;
                        $('.drop-area').removeClass('drop-area-hover');
                        $('.drop-area').addClass('drop-area-ready-to-deploy');
                        drop_area_content = `<p style="margin-bottom:0; font-weight: 500;">${items.length} items</p><p>Ready to deploy 🚀</p><p class="reset-deploy"><span>Cancel</span></p>`;
                        $('.drop-area').html(drop_area_content);
                        $('.deploy-btn').removeClass('disabled');
                    } else {
                        puter.ui.alert('You need to have an index.html file in your deployment.', [
                            {
                                label: 'Ok',
                            },
                        ]);
                        $('.drop-area').removeClass('drop-area-ready-to-deploy');
                        $('.deploy-btn').addClass('disabled');
                        dropped_items = [];
                    }
                }
            }
        }
    });
}

export default init_apps;
