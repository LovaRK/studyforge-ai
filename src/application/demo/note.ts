/** Original, redistributable demo material. Keep demo/swift-value-semantics.md in sync. */
export const DEMO_NOTE = `# Value and reference semantics in Swift

A value type gives each variable its own logical value, so changing one copy does not change another. Swift arrays use copy-on-write storage to avoid copying their buffer until a mutation needs an independent value. This preserves value semantics while sharing storage as an implementation detail.

A class instance has reference identity, so two variables can point at the same object. Mutating that object through either reference is visible through the other reference. Use reference semantics when shared identity and coordinated lifetime are part of the model.

Choosing between them starts with the behavior the program needs. Prefer a value when independent copies make the state easier to reason about. Choose a reference when the same identifiable object must be observed and changed from several places.`;
