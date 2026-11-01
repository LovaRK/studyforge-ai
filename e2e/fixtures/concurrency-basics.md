# Concurrency basics

Grand Central Dispatch runs work items on queues that the system manages for you.
The main queue is serial, so user interface updates should always be sent to it.
