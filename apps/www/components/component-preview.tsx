import { ComponentPreviewTabs } from "@/components/component-preview-tabs"
import { ComponentSource } from "@/components/component-source"
import { examples, type ExampleName } from "@/registry/examples"

// A live example from `registry/examples`, with its source in a Code tab.
export function ComponentPreview({
  name,
  className,
  previewClassName,
  align,
}: {
  name: ExampleName
  className?: string
  previewClassName?: string
  align?: "center" | "start" | "end"
}) {
  const example = examples[name]

  return (
    <ComponentPreviewTabs
      className={className}
      previewClassName={previewClassName}
      align={align}
      component={example.render()}
      source={<ComponentSource src={example.file} />}
    />
  )
}
