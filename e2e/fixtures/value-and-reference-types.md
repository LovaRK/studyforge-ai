# Swift value and reference types

Structs and enums in Swift are value types, so every variable keeps its own copy of the data.
Classes are reference types, so two variables can point at the same instance in memory.
Changing a copied struct never changes the original, which makes value types easy to reason about.

## Copy on write

Swift collections such as Array and Dictionary use copy on write to stay fast.
The storage is shared until one of the copies is mutated, and only then is it duplicated.

## Choosing between them

Choose a class when you need identity, inheritance, or shared mutable state.
Reach for a struct first when you are modelling plain data that is passed around.
