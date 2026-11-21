import { Controller } from "fake-forms"

import { PliantRoot } from "@pliantui/react"

import { Banner } from "@/components/banner"
import { Input } from "@/components/input"

export default function PackageFieldPage() {
  return (
    <PliantRoot surface="package-field">
      <Banner />
      <Controller
        name="email"
        render={({ field }: { field: { name: string } }) => (
          <Input {...field} />
        )}
      />
    </PliantRoot>
  )
}
