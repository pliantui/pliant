// The asks each mockup preview plays, by page. The page data and the
// previews both read them here, so the two lists can't drift apart, and
// the previews don't load the rest of the page data.
export const mockupAsks = {
  messages: {
    renameOverdue: "call the overdue card dues",
    renameAov: "rename average order value to aov",
    original: "go back to the original name",
  },
  chart: {
    bars: "show this as a bar chart",
    stack: "stack by status",
    overdueOnly: "only show overdue",
    thisQuarter: "only this quarter",
    percent: "show stacks as percentages",
  },
  stat: {
    compare: "compare with last quarter",
    rupees: "show the difference in rupees",
    overdue: "show overdue value instead",
  },
  list: {
    overdueSouth: "only overdue orders in the south",
    group: "group by customer",
    compact: "make the list compact",
  },
  "tabs-and-panels": {
    openInvoices: "open on invoices",
    notesFirst: "put notes first",
  },
  actions: {
    exportToToolbar: "put export on the toolbar",
    bindExport: "bind shift e to export",
  },
  dialog: {
    sheet: "open this as a side sheet",
    bigger: "make it bigger",
    drawer: "show it as a drawer from the bottom",
    foldNotes: "fold delivery notes away",
  },
  suggestions: {
    overdue: "only overdue orders",
    highlight: "highlight overdue orders over ₹1L",
  },
  "customized-indicator": {
    list: "what have i changed here",
    undo: "undo my changes to this table",
    who: "who set this layout",
  },
  reset: {
    table: "reset this table",
    page: "reset the whole page",
    metrics: "put the key metrics back",
  },
  "history-and-undo": {
    undo: "undo that",
    morning: "go back to how it was this morning",
    today: "what did i change today",
  },
  "share-link": {
    kavya: "share this view with kavya",
    tableOnly: "share just the table",
    keep: "keep this shared view",
  },
  "team-publish": {
    team: "publish this for my team",
    everyone: "make this the default for everyone",
    remove: "remove the team default",
  },
  "text-size-density-motion": {
    bigger: "make the text bigger",
    compact: "compact spacing on this page",
    still: "turn off animations",
  },
} as const
