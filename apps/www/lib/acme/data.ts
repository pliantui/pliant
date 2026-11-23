import { mulberry32 } from "@/lib/demo/random"

// The data of the Acme Inc. dashboard on the home page: the sections of a
// proposal the team is writing, the site's daily visitors and the
// company's monthly figures. The rows are small, so the dashboard's client
// components import them directly. The proposal sections follow the
// sample data of shadcn's dashboard-01 block.

export const sectionTypes = [
  "Cover page",
  "Financial",
  "Legal",
  "Narrative",
  "Plain language",
  "Research",
  "Table of contents",
  "Technical content",
  "Visual",
] as const

export const sectionStatuses = ["In Process", "Done"] as const

export interface Section {
  id: number
  header: string
  type: (typeof sectionTypes)[number]
  status: (typeof sectionStatuses)[number]
  // Pages the section is planned to take, and the most it may take.
  target: number
  limit: number
  // `null` until someone is assigned.
  reviewer: string | null
}

export const sections: Section[] = [
  {
    id: 1,
    header: "Cover page",
    type: "Cover page",
    status: "In Process",
    target: 18,
    limit: 5,
    reviewer: "Eddie Lake",
  },
  {
    id: 2,
    header: "Table of contents",
    type: "Table of contents",
    status: "Done",
    target: 29,
    limit: 24,
    reviewer: "Eddie Lake",
  },
  {
    id: 3,
    header: "Executive summary",
    type: "Narrative",
    status: "Done",
    target: 10,
    limit: 13,
    reviewer: "Eddie Lake",
  },
  {
    id: 4,
    header: "Technical approach",
    type: "Narrative",
    status: "Done",
    target: 27,
    limit: 23,
    reviewer: "Jamik Tashpulatov",
  },
  {
    id: 5,
    header: "Design",
    type: "Narrative",
    status: "In Process",
    target: 2,
    limit: 16,
    reviewer: "Jamik Tashpulatov",
  },
  {
    id: 6,
    header: "Capabilities",
    type: "Narrative",
    status: "In Process",
    target: 20,
    limit: 8,
    reviewer: "Jamik Tashpulatov",
  },
  {
    id: 7,
    header: "Integration with existing systems",
    type: "Narrative",
    status: "In Process",
    target: 19,
    limit: 21,
    reviewer: "Jamik Tashpulatov",
  },
  {
    id: 8,
    header: "Innovation and Advantages",
    type: "Narrative",
    status: "Done",
    target: 25,
    limit: 26,
    reviewer: null,
  },
  {
    id: 9,
    header: "Overview of EMR's Innovative Solutions",
    type: "Technical content",
    status: "Done",
    target: 7,
    limit: 23,
    reviewer: null,
  },
  {
    id: 10,
    header: "Advanced Algorithms and Machine Learning",
    type: "Narrative",
    status: "Done",
    target: 30,
    limit: 28,
    reviewer: null,
  },
  {
    id: 11,
    header: "Adaptive Communication Protocols",
    type: "Narrative",
    status: "Done",
    target: 9,
    limit: 31,
    reviewer: null,
  },
  {
    id: 12,
    header: "Advantages Over Current Technologies",
    type: "Narrative",
    status: "Done",
    target: 12,
    limit: 0,
    reviewer: null,
  },
  {
    id: 13,
    header: "Past Performance",
    type: "Narrative",
    status: "Done",
    target: 22,
    limit: 33,
    reviewer: null,
  },
  {
    id: 14,
    header: "Customer Feedback and Satisfaction Levels",
    type: "Narrative",
    status: "Done",
    target: 15,
    limit: 34,
    reviewer: null,
  },
  {
    id: 15,
    header: "Implementation Challenges and Solutions",
    type: "Narrative",
    status: "Done",
    target: 3,
    limit: 35,
    reviewer: null,
  },
  {
    id: 16,
    header: "Security Measures and Data Protection Policies",
    type: "Narrative",
    status: "In Process",
    target: 6,
    limit: 36,
    reviewer: null,
  },
  {
    id: 17,
    header: "Scalability and Future Proofing",
    type: "Narrative",
    status: "Done",
    target: 4,
    limit: 37,
    reviewer: null,
  },
  {
    id: 18,
    header: "Cost-Benefit Analysis",
    type: "Plain language",
    status: "Done",
    target: 14,
    limit: 38,
    reviewer: null,
  },
  {
    id: 19,
    header: "User Training and Onboarding Experience",
    type: "Narrative",
    status: "Done",
    target: 17,
    limit: 39,
    reviewer: null,
  },
  {
    id: 20,
    header: "Future Development Roadmap",
    type: "Narrative",
    status: "Done",
    target: 11,
    limit: 40,
    reviewer: null,
  },
  {
    id: 21,
    header: "System Architecture Overview",
    type: "Technical content",
    status: "In Process",
    target: 24,
    limit: 18,
    reviewer: "Maya Johnson",
  },
  {
    id: 22,
    header: "Risk Management Plan",
    type: "Narrative",
    status: "Done",
    target: 15,
    limit: 22,
    reviewer: "Carlos Rodriguez",
  },
  {
    id: 23,
    header: "Compliance Documentation",
    type: "Legal",
    status: "In Process",
    target: 31,
    limit: 27,
    reviewer: "Sarah Chen",
  },
  {
    id: 24,
    header: "API Documentation",
    type: "Technical content",
    status: "Done",
    target: 8,
    limit: 12,
    reviewer: "Raj Patel",
  },
  {
    id: 25,
    header: "User Interface Mockups",
    type: "Visual",
    status: "In Process",
    target: 19,
    limit: 25,
    reviewer: "Leila Ahmadi",
  },
  {
    id: 26,
    header: "Database Schema",
    type: "Technical content",
    status: "Done",
    target: 22,
    limit: 20,
    reviewer: "Thomas Wilson",
  },
  {
    id: 27,
    header: "Testing Methodology",
    type: "Technical content",
    status: "In Process",
    target: 17,
    limit: 14,
    reviewer: null,
  },
  {
    id: 28,
    header: "Deployment Strategy",
    type: "Narrative",
    status: "Done",
    target: 26,
    limit: 30,
    reviewer: "Eddie Lake",
  },
  {
    id: 29,
    header: "Budget Breakdown",
    type: "Financial",
    status: "In Process",
    target: 13,
    limit: 16,
    reviewer: "Jamik Tashpulatov",
  },
  {
    id: 30,
    header: "Market Analysis",
    type: "Research",
    status: "Done",
    target: 29,
    limit: 32,
    reviewer: "Sophia Martinez",
  },
  {
    id: 31,
    header: "Competitor Comparison",
    type: "Research",
    status: "In Process",
    target: 21,
    limit: 19,
    reviewer: null,
  },
  {
    id: 32,
    header: "Maintenance Plan",
    type: "Technical content",
    status: "Done",
    target: 16,
    limit: 23,
    reviewer: "Alex Thompson",
  },
  {
    id: 33,
    header: "User Personas",
    type: "Research",
    status: "In Process",
    target: 27,
    limit: 24,
    reviewer: "Nina Patel",
  },
  {
    id: 34,
    header: "Accessibility Compliance",
    type: "Legal",
    status: "Done",
    target: 18,
    limit: 21,
    reviewer: null,
  },
  {
    id: 35,
    header: "Performance Metrics",
    type: "Technical content",
    status: "In Process",
    target: 23,
    limit: 26,
    reviewer: "David Kim",
  },
  {
    id: 36,
    header: "Disaster Recovery Plan",
    type: "Technical content",
    status: "Done",
    target: 14,
    limit: 17,
    reviewer: "Jamik Tashpulatov",
  },
  {
    id: 37,
    header: "Third-party Integrations",
    type: "Technical content",
    status: "In Process",
    target: 25,
    limit: 28,
    reviewer: "Eddie Lake",
  },
  {
    id: 38,
    header: "User Feedback Summary",
    type: "Research",
    status: "Done",
    target: 20,
    limit: 15,
    reviewer: null,
  },
  {
    id: 39,
    header: "Localization Strategy",
    type: "Narrative",
    status: "In Process",
    target: 12,
    limit: 19,
    reviewer: "Maria Garcia",
  },
  {
    id: 40,
    header: "Mobile Compatibility",
    type: "Technical content",
    status: "Done",
    target: 28,
    limit: 31,
    reviewer: "James Wilson",
  },
]

export interface DailyVisitors {
  // An ISO date, like "2026-11-22".
  date: string
  desktop: number
  mobile: number
}

const dayInMs = 24 * 60 * 60 * 1000
// The dashboard's "today": its data runs to the day before.
export const lastDay = "2026-11-22"

function generateVisitors(seed: number): DailyVisitors[] {
  const random = mulberry32(seed)
  const end = Date.parse(lastDay)
  return Array.from({ length: 91 }, (_, index) => {
    const date = new Date(end - (90 - index) * dayInMs)
    const weekend = [0, 6].includes(date.getUTCDay())
    const trend = 1 + index / 180
    return {
      date: date.toISOString().slice(0, 10),
      desktop: Math.round((weekend ? 140 : 260) * trend + random() * 160),
      mobile: Math.round((weekend ? 230 : 170) * trend + random() * 140),
    }
  })
}

export const visitors = generateVisitors(2026)

export interface MonthlyFigures {
  // The first day of the month, as `YYYY-MM-01`.
  month: string
  revenue: number
  newCustomers: number
  activeAccounts: number
}

export const monthlyFigures: MonthlyFigures[] = [
  {
    month: "2026-06-01",
    revenue: 98_400,
    newCustomers: 1_310,
    activeAccounts: 40_920,
  },
  {
    month: "2026-07-01",
    revenue: 104_250,
    newCustomers: 1_420,
    activeAccounts: 41_870,
  },
  {
    month: "2026-08-01",
    revenue: 101_800,
    newCustomers: 1_280,
    activeAccounts: 42_640,
  },
  {
    month: "2026-09-01",
    revenue: 109_600,
    newCustomers: 1_550,
    activeAccounts: 43_710,
  },
  {
    month: "2026-10-01",
    revenue: 111_100,
    newCustomers: 1_545,
    activeAccounts: 43_720,
  },
  {
    month: "2026-11-01",
    revenue: 125_000,
    newCustomers: 1_234,
    activeAccounts: 45_678,
  },
]

// The sections' fields, which derived columns, highlights and groupings
// read.
export const sectionsDataset = {
  fields: {
    id: { type: "integer" },
    header: { type: "string" },
    type: { type: "enum", values: sectionTypes },
    status: { type: "enum", values: sectionStatuses },
    target: { type: "integer" },
    limit: { type: "integer" },
    reviewer: { type: "string" },
  },
  timeZone: "UTC",
} as const
