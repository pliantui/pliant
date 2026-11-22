/** A node's identity: its bare id, the part after its last `/slots/`. */
export function identityOf(target: string): string {
  return target.split("/slots/").at(-1) ?? target
}
