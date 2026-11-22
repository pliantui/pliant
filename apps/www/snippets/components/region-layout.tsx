// #region layout
import { PliantRegion } from "@/components/pliant/pliant-region"

export function SettingsSections() {
  return (
    <PliantRegion
      id="settings-sections"
      className="grid-cols-1 md:grid-cols-2"
      slots={{
        profile: <section className="rounded-xl border p-4">Profile</section>,
        notifications: (
          <section className="rounded-xl border p-4">Notifications</section>
        ),
      }}
    />
  )
}
// #endregion layout
