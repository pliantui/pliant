import { Banner } from "@/components/banner"

function Pick({ framed }: { framed?: boolean }) {
  const Frame = framed ? Banner : "div"
  return <Frame />
}

export function renderIt() {
  return <Pick framed />
}
