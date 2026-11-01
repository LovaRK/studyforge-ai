# Secure storage

The Keychain stores small secrets such as tokens in an encrypted database that survives app reinstalls.
Access groups let several apps from the same team read the same Keychain entries.
UserDefaults is meant for preferences and should never hold credentials or tokens.
