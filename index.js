const siyuan = require("siyuan");
class Plugin extends siyuan.Plugin {
    constructor() {
        super(...arguments);
        this.qylListViewState = null;
    }
    onload() {
        this.initQYLListView();
    }
    onunload() {
        this.removeQYLListView();
    }
    uninstall() {
        this.removeQYLListView();
    }
    initQYLListView() {
        if (this.qylListViewState) {
            this.removeQYLListView();
        }
        this.createQYLListViewStandalone();
    }
    removeQYLListView() {
        if (this.qylListViewState) {
            if (this.qylListViewState.commonMenuObserver) {
                this.qylListViewState.commonMenuObserver.disconnect();
                this.qylListViewState.commonMenuObserver = null;
            }
            this.qylListViewState.isClickMonitorActive = false;
            this.qylListViewState.commonMenuElement = null;
            this.qylListViewState.searchAttempts = 0;
            this.qylListViewState.isCreatingListView = false;
            this.qylListViewState = null;
        }
    }
    createQYLListViewStandalone() {
        this.qylListViewState = {
            plugin: this,
            isClickMonitorActive: false,
            commonMenuObserver: null,
            commonMenuElement: null,
            searchAttempts: 0,
            maxSearchAttempts: 15,
            searchInterval: 100,
            isCreatingListView: false
        };
        const startCommonMenuMonitor = () => {
            if (this.qylListViewState.isClickMonitorActive) return;
            this.qylListViewState.isClickMonitorActive = true;
            searchCommonMenu();
        };
        const searchCommonMenu = () => {
            this.qylListViewState.commonMenuElement = document.querySelector('#commonMenu');
            if (this.qylListViewState.commonMenuElement) {
                setupCommonMenuObserver();
            } else {
                this.qylListViewState.searchAttempts++;
                if (this.qylListViewState.searchAttempts < this.qylListViewState.maxSearchAttempts) {
                    setTimeout(() => {
                        searchCommonMenu();
                    }, this.qylListViewState.searchInterval);
                }
            }
        };
        const setupCommonMenuObserver = () => {
            if (this.qylListViewState.commonMenuObserver) {
                this.qylListViewState.commonMenuObserver.disconnect();
            }
            this.qylListViewState.commonMenuObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        const target = mutation.target;
                        const oldValue = mutation.oldValue || '';
                        const newValue = target.className;
                        const hadFnNone = oldValue.includes('fn__none');
                        const hasFnNone = newValue.includes('fn__none');
                        if (hadFnNone && !hasFnNone) {
                            handleCommonMenuShow();
                        }
                    }
                });
            });
            this.qylListViewState.commonMenuObserver.observe(this.qylListViewState.commonMenuElement, {
                attributes: true,
                attributeFilter: ['class'],
                attributeOldValue: true
            });
        };
        const handleCommonMenuShow = () => {
            if (this.qylListViewState.isCreatingListView || document.querySelector('#QYL-ListView')) {
                return;
            }
            this.qylListViewState.isCreatingListView = true;
            const blockInfo = getBlockSelected();
            if (blockInfo) {
                if (blockInfo.type === "NodeList") {
                    insertQYLListView(blockInfo.id);
                }
            }
            setTimeout(() => {
                this.qylListViewState.isCreatingListView = false;
            }, 100);
        };
        const insertQYLListView = async (selectid) => {
            const menu = getCommonMenu();
            if (!menu) return;
            const hasExport = Array.from(menu.children).find(child => child.getAttribute('data-id') === 'export');
            const hasUpdate = Array.from(menu.children).find(child => child.getAttribute('data-id') === 'updateAndCreatedAt');
            const attritem = menu.querySelector('#QYL-ListView');
            if (!hasExport && hasUpdate && !attritem) {
                const QYLBtn = await createQYLListViewItem(selectid);
                menu.insertBefore(QYLBtn, hasUpdate);
                if (QYLBtn.nextSibling) {
                    menu.insertBefore(createMenuSeparator(), QYLBtn.nextSibling);
                } else {
                    menu.appendChild(createMenuSeparator());
                }
            }
        };
        const getCommonMenu = () => {
            const commonMenu = document.querySelector("#commonMenu .b3-menu__items");
            return commonMenu;
        };
        const createMenuSeparator = (className = `b3-menu__separator`) => {
            let node = document.createElement(`button`);
            node.className = className;
            node.setAttribute('data-qyl-separator', 'true');
            return node;
        };
        const createQYLListViewItem = (selectid) => {
            let button = document.createElement("button");
            button.id = "QYL-ListView";
            button.className = "b3-menu__item";
            button.innerHTML = `<svg class="b3-menu__icon"><use xlink:href="#iconList"></use></svg><span class="b3-menu__label" style="">${this.i18n.listview}</span><svg class="b3-menu__icon b3-menu__icon--arrow" style="height: 10px;width: 10px;line-height: 10px;"><use xlink:href="#iconRight"></use></svg></button>`;
            button.appendChild(createListViewSubmenu(selectid));
            return button;
        };
        const createListViewSubmenu = (selectid) => {
            const items = [
                createMenuItem(this.i18n.listviewmindmap, "#iconGlobalGraph", "list-view", "脑图", selectid),
                createMenuItem(this.i18n.listviewkanban, "#iconMenu", "list-view", "看板", selectid),
                createMenuItem(this.i18n.listviewtable, "#iconTable", "list-view", "表格", selectid),
                createMenuItem(this.i18n.listviewtimeline, "#iconClock", "list-view", "时间轴", selectid),
                createMenuItem(this.i18n.listviewlist, "#iconList", "list-view", "列表", selectid)
            ];
            return createSubmenu("QYLListViewSub", items);
        };
        const createSubmenu = (id, items) => {
            const div = document.createElement("div");
            div.id = id;
            div.className = "b3-menu__submenu";
            const itemsDiv = document.createElement("div");
            itemsDiv.className = "b3-menu__items";
            items.forEach(item => {
                itemsDiv.appendChild(item);
            });
            div.appendChild(itemsDiv);
            return div;
        };
        const createMenuItem = (label, icon, attrName, attrValue, selectid = "") => {
            const button = document.createElement("button");
            button.className = "b3-menu__item";
            button.setAttribute("data-QYL-attr-id", selectid);
            button.setAttribute("custom-attr-name", attrName);
            button.setAttribute("custom-attr-value", attrValue);
            button.innerHTML = `
                <svg class="b3-menu__icon"><use xlink:href="${icon}"></use></svg>
                <span class="b3-menu__label">${label}</span>
            `;
            button.onclick = async (e) => {
                const id = button.getAttribute("data-QYL-attr-id");
                const attrNameFull = 'custom-' + button.getAttribute("custom-attr-name");
                const attrValue = button.getAttribute("custom-attr-value");
                try {
                    await setCustomAttribute(id, attrNameFull, attrValue);
                } catch (error) {
                }
            };
            return button;
        };
        const setCustomAttribute = async (id, attrName, attrValue) => {
            const blocks = document.querySelectorAll(`.protyle-wysiwyg [data-node-id="${id}"]`);
            blocks.forEach(block => block.setAttribute(attrName, attrValue));
            const attrs = { [attrName]: attrValue };
            return setBlockAttributes(id, attrs);
        };
        const setBlockAttributes = async (blockId, attributes) => {
            const response = await requestData('/api/attr/setBlockAttrs', {
                id: blockId,
                attrs: attributes,
            });
            return parseResponse(response);
        };
        const requestData = async (url, data) => {
            try {
                const response = await fetch(url, {
                    body: JSON.stringify(data),
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        Authorization: 'Token ' 
                    } 
                });
                return response.ok ? await response.json() : null;
            } catch {
                return null;
            }
        };
        const parseResponse = (response) => {
            if (!response) return null;
            return response.code === 0 ? response.data : null;
        };
        const _getSelectedElement = (selector) => {
            const node_list = document.querySelectorAll(selector);
            if (node_list.length === 1 && node_list[0].dataset.nodeId != null) {
                return {
                    id: node_list[0].dataset.nodeId,
                    type: node_list[0].dataset.type,
                };
            }
            return null;
        };
        const getBlockSelected = () => {
            return _getSelectedElement('.protyle-wysiwyg--select');
        };
        startCommonMenuMonitor();
    }
}
module.exports = Plugin;
