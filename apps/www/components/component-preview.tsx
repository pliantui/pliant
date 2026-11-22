import { ComponentPreviewTabs } from "@/components/component-preview-tabs"
import { ComponentSource } from "@/components/component-source"
import { examples, type ExampleName } from "@/registry/examples"

// A live example from `registry/examples`, with its source in a Code tab.
export async function ComponentPreview({
  name,
  className,
  previewClassName,
  align,
  hideCode,
}: {
  name: ExampleName
  className?: string
  previewClassName?: string
  align?: "center" | "start" | "end"
  hideCode?: boolean
}) {
  const example = examples[name]

  return (
    <ComponentPreviewTabs
      className={className}
      previewClassName={previewClassName}
      align={align}
      hideCode={hideCode}
      component={await example.render()}
      source={<ComponentSource src={example.file} />}
    />
  )
}
