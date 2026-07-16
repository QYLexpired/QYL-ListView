import siyuan from "siyuan";
interface IMenuItem {
  iconHTML?: string;
  label?: string;
  click?: () => void;
  submenu?: IMenuItem[];
}
interface ISubMenu {
  addItem: (item: IMenuItem) => void;
}
interface BlockIconDetail {
  blockElements: HTMLElement[];
  menu: ISubMenu;
}
interface ViewConfig {
  i18nKey: string;
  icon: string;
  type: string;
}
const VIEWS: readonly ViewConfig[] = [
  { i18nKey: "listviewmindmap",   icon: "#iconGlobalGraph", type: "mindmap" },
  { i18nKey: "listviewkanban",    icon: "#iconMenu",        type: "kanban" },
  { i18nKey: "listviewtable",     icon: "#iconTable",       type: "table" },
  { i18nKey: "listviewtimeline",  icon: "#iconClock",       type: "timeline" },
  { i18nKey: "listviewtab",       icon: "#iconDock",        type: "tab" },
  { i18nKey: "listviewlist",      icon: "#iconList",        type: "" },
];
const attrName = "custom-list-view";
const tabStateMap = new WeakMap<HTMLElement, { originalHTML: string }>();
class ListViewPlugin extends siyuan.Plugin {
  public i18n!: Record<string, string>;
  private blockIconHandler: ((event: CustomEvent<BlockIconDetail>) => void) | null = null;
  private tabObserver: MutationObserver | null = null;
  private tabDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  public onload(): void {
    this.initListView();
    this.scheduleTabInit();
  }
  public onunload(): void {
    this.removeListView();
    this.cleanupTabObserver();
  }
  public uninstall(): void {
    this.removeListView();
    this.cleanupTabObserver();
  }
  private initListView(): void {
    this.removeListView();
    this.blockIconHandler = ({ detail }: CustomEvent<BlockIconDetail>): void => {
      const { blockElements, menu } = detail;
      const blockEl = blockElements?.[0];
      if (!blockEl) return;
      const blockId = blockEl.getAttribute("data-node-id");
      const blockType = blockEl.getAttribute("data-type");
      if (!blockId || blockType !== "NodeList") return;
      if (!menu || typeof menu.addItem !== "function") return;
      menu.addItem(this.buildMenuItem(blockId));
    };
    this.eventBus.on("click-blockicon", this.blockIconHandler);
  }
  private removeListView(): void {
    if (this.blockIconHandler) {
      this.eventBus.off("click-blockicon", this.blockIconHandler);
      this.blockIconHandler = null;
    }
  }
  private buildMenuItem(blockId: string): IMenuItem {
    return {
      iconHTML: `<svg class="b3-menu__icon"><use xlink:href="#iconList"></use></svg>`,
      label: this.i18n.listview,
      submenu: VIEWS.map(({ i18nKey, icon, type }) => ({
        iconHTML: `<svg class="b3-menu__icon"><use xlink:href="${icon}"></use></svg>`,
        label: this.i18n[i18nKey],
        click: () => this.setListView(blockId, type)
      }))
    };
  }
  private async setListView(blockId: string, viewType: string): Promise<void> {
    const blocks = document.querySelectorAll(`.protyle-wysiwyg [data-node-id="${blockId}"]`);
    blocks.forEach((el) => {
      el.setAttribute(attrName, viewType);
      if (viewType === "tab") {
        this.convertToTabView(el as HTMLElement);
      } else {
        this.restoreFromTabView(el as HTMLElement);
      }
    });
    try {
      await fetch("/api/attr/setBlockAttrs", {
        body: JSON.stringify({ id: blockId, attrs: { [attrName]: viewType } }),
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Token "
        }
      });
    } catch {}
  }
  // ---- 页签视图 ----
  private convertToTabView(listElement: HTMLElement): void {
    if (tabStateMap.has(listElement)) return;
    const children = listElement.querySelectorAll(":scope > .li");
    if (children.length < 1) return;
    tabStateMap.set(listElement, { originalHTML: listElement.innerHTML });
    const headerContainer = document.createElement("div");
    headerContainer.className = "tab-header-container";
    const headers = document.createElement("div");
    headers.className = "tab-headers";
    const contentsContainer = document.createElement("div");
    contentsContainer.className = "tab-contents";
    children.forEach((li, index) => {
      const firstChild = li.querySelector(":scope > [data-node-id]:not(.list)");
      const subList = li.querySelector(":scope > .list");
      const tabHeader = document.createElement("div");
      tabHeader.className = `tab-header${index === 0 ? " active" : ""}`;
      if (firstChild) tabHeader.appendChild(firstChild.cloneNode(true));
      const tabContent = document.createElement("div");
      tabContent.className = `tab-content${index === 0 ? " active" : ""}`;
      if (subList) tabContent.appendChild(subList.cloneNode(true));
      headers.appendChild(tabHeader);
      contentsContainer.appendChild(tabContent);
    });
    headerContainer.appendChild(headers);
    listElement.replaceChildren(headerContainer, contentsContainer);
    headers.addEventListener("click", (event) => {
      const clickedTab = (event.target as HTMLElement).closest(".tab-header");
      if (!clickedTab) return;
      event.preventDefault();
      event.stopPropagation();
      const allTabs = headers.querySelectorAll(".tab-header");
      const allContents = contentsContainer.querySelectorAll(".tab-content");
      allTabs.forEach((t) => t.classList.remove("active"));
      allContents.forEach((c) => c.classList.remove("active"));
      clickedTab.classList.add("active");
      const idx = Array.prototype.indexOf.call(allTabs, clickedTab);
      if (idx >= 0) allContents[idx]?.classList.add("active");
    });
  }
  private restoreFromTabView(listElement: HTMLElement): void {
    const state = tabStateMap.get(listElement);
    if (!state) return;
    listElement.innerHTML = state.originalHTML;
    tabStateMap.delete(listElement);
  }
  private scheduleTabInit(): void {
    setTimeout(() => this.initTabViews(), 100);
    this.tabObserver = new MutationObserver(() => {
      if (this.tabDebounceTimer) clearTimeout(this.tabDebounceTimer);
      this.tabDebounceTimer = setTimeout(() => {
        this.tabDebounceTimer = null;
        this.initTabViews();
      }, 200);
    });
    this.tabObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [attrName]
    });
  }
  private initTabViews(): void {
    document
      .querySelectorAll(`.protyle-wysiwyg [data-type="NodeList"][${attrName}="tab"]`)
      .forEach((el) => {
        if (!tabStateMap.has(el as HTMLElement)) {
          this.convertToTabView(el as HTMLElement);
        }
      });
  }
  private cleanupTabObserver(): void {
    document
      .querySelectorAll(`.protyle-wysiwyg [data-type="NodeList"][${attrName}="tab"]`)
      .forEach((el) => {
        this.restoreFromTabView(el as HTMLElement);
        el.removeAttribute(attrName);
      });
    this.tabObserver?.disconnect();
    this.tabObserver = null;
    if (this.tabDebounceTimer) {
      clearTimeout(this.tabDebounceTimer);
      this.tabDebounceTimer = null;
    }
  }
}
export default ListViewPlugin;
