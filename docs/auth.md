A human being can have 1 or many accounts. Each account has many identifiers. 
An identifier can be an email, a sub claim from the oauth2 provider, ....

The account has a primary email, which is a reference to the identifier with type email. This email will be used for communication.

When the user signs up via oauth2 the application doesn't automatically link an existing account with a matching email.
Instead, we throw an exception and ask the user to log in with their existing account and link oauth2 manually.
This reduces the risk of account hijacking using a provider that doesn't verify an email.

Each account has a membership in a workspace. An account can have many memberships. A membership can have only 1 workspace.
A workspace can have many memberships. 

A client (Web) can have many active accounts at the same time. For instance, a person can have one account for personal use, another for work.
It's nice UX to be able to seamlessly switch between those.
