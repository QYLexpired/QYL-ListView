const siyuan = require("siyuan");

interface SelectedBlock {
  id: string;
  type: string;
}

interface QylListViewState {
  plugin: QylListViewPlugin;
  isClickMonitorActive: boolean;
  commonMenuObserver: MutationObserver | null;
  commonMenuElement: HTMLElement | null;
  searchAttempts: number;
  maxSearchAttempts: number;
  searchInterval: number;
  isCreatingListView: boolean;
}

type AttributeMap = Record<string, string>;

class QylListViewPlugin extends siyuan.Plugin {
  public i18n!: Record<string, string>;
  private qylListViewState: QylListViewState | null = null;

  public onload(): void {
    this.initQYLListView();
  }

  public onunload(): void {
    this.removeQYLListView();
  }

  public uninstall(): void {
    this.removeQYLListView();
  }

  private initQYLListView(): void {
    if (this.qylListViewState) {
      this.removeQYLListView();
    }
    this.createQYLListViewStandalone();
  }

  private removeQYLListView(): void {
    if (!this.qylListViewState) {
      return;
    }
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

  private createQYLListViewStandalone(): void {
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

    const startCommonMenuMonitor = (): void => {
      if (!this.qylListViewState || this.qylListViewState.isClickMonitorActive) {
        return;
      }
      this.qylListViewState.isClickMonitorActive = true;
      searchCommonMenu();
    };

    const searchCommonMenu = (): void => {
      if (!this.qylListViewState) {
        return;
      }
      this.qylListViewState.commonMenuElement = document.querySelector<HTMLElement>("#commonMenu");
      if (this.qylListViewState.commonMenuElement) {
        setupCommonMenuObserver();
      } else {
        this.qylListViewState.searchAttempts += 1;
        if (this.qylListViewState.searchAttempts < this.qylListViewState.maxSearchAttempts) {
          setTimeout(searchCommonMenu, this.qylListViewState.searchInterval);
        }
      }
    };

    const setupCommonMenuObserver = (): void => {
      if (!this.qylListViewState || !this.qylListViewState.commonMenuElement) {
        return;
      }
      if (this.qylListViewState.commonMenuObserver) {
        this.qylListViewState.commonMenuObserver.disconnect();
      }
      this.qylListViewState.commonMenuObserver = new MutationObserver((mutations: MutationRecord[]) => {
        mutations.forEach((mutation) => {
          if (mutation.type === "attributes" && mutation.attributeName === "class") {
            const target = mutation.target as HTMLElement;
            const oldValue = mutation.oldValue ?? "";
            const newValue = target.className;
            const hadFnNone = oldValue.includes("fn__none");
            const hasFnNone = newValue.includes("fn__none");
            if (hadFnNone && !hasFnNone) {
              handleCommonMenuShow();
            }
          }
        });
      });
      this.qylListViewState.commonMenuObserver.observe(this.qylListViewState.commonMenuElement, {
        attributes: true,
        attributeFilter: ["class"],
        attributeOldValue: true
      });
    };

    const handleCommonMenuShow = (): void => {
      if (
        !this.qylListViewState ||
        this.qylListViewState.isCreatingListView ||
        document.querySelector("#QYL-ListView")
      ) {
        return;
      }
      this.qylListViewState.isCreatingListView = true;
      const blockInfo = getBlockSelected();
      if (blockInfo && blockInfo.type === "NodeList") {
        void insertQYLListView(blockInfo.id);
      }
      setTimeout(() => {
        if (this.qylListViewState) {
          this.qylListViewState.isCreatingListView = false;
        }
      }, 100);
    };

    const insertQYLListView = async (selectId: string): Promise<void> => {
      const menu = getCommonMenu();
      if (!menu) return;
      const children = Array.from(menu.children);
      const hasExport = children.find((child) => child.getAttribute("data-id") === "export");
      const hasUpdate = children.find((child) => child.getAttribute("data-id") === "updateAndCreatedAt");
      const attrItem = menu.querySelector("#QYL-ListView");
      if (!hasExport && hasUpdate && !attrItem) {
        const qylBtn = await createQYLListViewItem(selectId);
        menu.insertBefore(qylBtn, hasUpdate);
        if (qylBtn.nextSibling) {
          menu.insertBefore(createMenuSeparator(), qylBtn.nextSibling);
        } else {
          menu.appendChild(createMenuSeparator());
        }
      }
    };

    const getCommonMenu = (): HTMLElement | null => {
      return document.querySelector<HTMLElement>("#commonMenu .b3-menu__items");
    };

    const createMenuSeparator = (className = "b3-menu__separator"): HTMLButtonElement => {
      const node = document.createElement("button");
      node.className = className;
      node.setAttribute("data-qyl-separator", "true");
      return node;
    };

    const createQYLListViewItem = async (selectId: string): Promise<HTMLButtonElement> => {
      const button = document.createElement("button");
      button.id = "QYL-ListView";
      button.className = "b3-menu__item";
      button.innerHTML = `
        <svg class="b3-menu__icon"><use xlink:href="#iconList"></use></svg>
        <span class="b3-menu__label">${this.i18n.listview}</span>
        <svg class="b3-menu__icon b3-menu__icon--small"><use xlink:href="#iconRight"></use></svg>
      `;
      button.appendChild(createListViewSubmenu(selectId));
      return button;
    };

    const createListViewSubmenu = (selectId: string): HTMLDivElement => {
      const items = [
        createMenuItem(this.i18n.listviewmindmap, "#iconGlobalGraph", "list-view", "mindmap", selectId),
        createMenuItem(this.i18n.listviewkanban, "#iconMenu", "list-view", "kanban", selectId),
        createMenuItem(this.i18n.listviewtable, "#iconTable", "list-view", "table", selectId),
        createMenuItem(this.i18n.listviewtimeline, "#iconClock", "list-view", "timeline", selectId),
        createMenuItem(this.i18n.listviewlist, "#iconList", "list-view", "list", selectId)
      ];
      return createSubmenu("QYLListViewSub", items);
    };

    const createSubmenu = (id: string, items: HTMLElement[]): HTMLDivElement => {
      const div = document.createElement("div");
      div.id = id;
      div.className = "b3-menu__submenu";
      const itemsDiv = document.createElement("div");
      itemsDiv.className = "b3-menu__items";
      items.forEach((item) => {
        itemsDiv.appendChild(item);
      });
      div.appendChild(itemsDiv);
      return div;
    };

    const createMenuItem = (
      label: string,
      icon: string,
      attrName: string,
      attrValue: string,
      selectId = ""
    ): HTMLButtonElement => {
      const button = document.createElement("button");
      button.className = "b3-menu__item";
      button.setAttribute("data-QYL-attr-id", selectId);
      button.setAttribute("custom-attr-name", attrName);
      button.setAttribute("custom-attr-value", attrValue);
      button.innerHTML = `
        <svg class="b3-menu__icon"><use xlink:href="${icon}"></use></svg>
        <span class="b3-menu__label">${label}</span>
      `;
      button.onclick = async () => {
        const id = button.getAttribute("data-QYL-attr-id");
        const attrNamePartial = button.getAttribute("custom-attr-name");
        const attrValueSelected = button.getAttribute("custom-attr-value");
        if (!id || !attrNamePartial || !attrValueSelected) {
          return;
        }
        const attrNameFull = `custom-${attrNamePartial}`;
        try {
          await setCustomAttribute(id, attrNameFull, attrValueSelected);
        } catch {
          // Ignore errors to avoid breaking menu interactions
        }
      };
      return button;
    };

    const setCustomAttribute = async (id: string, attrName: string, attrValue: string): Promise<unknown> => {
      const blocks = document.querySelectorAll<HTMLElement>(`.protyle-wysiwyg [data-node-id="${id}"]`);
      blocks.forEach((block) => block.setAttribute(attrName, attrValue));
      const attrs: AttributeMap = { [attrName]: attrValue };
      return setBlockAttributes(id, attrs);
    };

    const setBlockAttributes = async (blockId: string, attributes: AttributeMap): Promise<unknown> => {
      const response = await requestData("/api/attr/setBlockAttrs", {
        id: blockId,
        attrs: attributes
      });
      return parseResponse(response);
    };

    const requestData = async (url: string, data: Record<string, unknown>): Promise<unknown> => {
      try {
        const response = await fetch(url, {
          body: JSON.stringify(data),
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Token "
          }
        });
        return response.ok ? await response.json() : null;
      } catch {
        return null;
      }
    };

    const parseResponse = (response: any): unknown => {
      if (!response) return null;
      return response.code === 0 ? response.data : null;
    };

    const _getSelectedElement = (selector: string): SelectedBlock | null => {
      const nodeList = document.querySelectorAll<HTMLElement>(selector);
      if (nodeList.length === 1) {
        const node = nodeList[0];
        if (node.dataset.nodeId) {
          return {
            id: node.dataset.nodeId,
            type: node.dataset.type ?? ""
          };
        }
      }
      return null;
    };

    const getBlockSelected = (): SelectedBlock | null => {
      return _getSelectedElement(".protyle-wysiwyg--select");
    };

    startCommonMenuMonitor();
  }
}

module.exports = QylListViewPlugin;

