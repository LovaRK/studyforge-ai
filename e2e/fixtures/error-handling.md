# Error handling

A throwing function must be called with try inside a do block or another throwing function.
The catch clauses run in order and the first one that matches handles the error.
A defer block runs when the scope exits, whether or not an error was thrown.
