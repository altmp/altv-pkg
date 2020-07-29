# alt:V Resource Installer

A community resource that allows users to easily install resources and ask questions during the installation process, install dependencies, clone the repository, and then handle the responses in their post install script.

This was created to easily install resources from your server's `base` directory.

### Find resources on [alt:V Hub](https://hub.altv.mp)!

<br />

# How to Use

## Install with Command Line

Make sure to get `NodeJS` Version `13+`.

If you get module not found errors. You don't have `13+`.

```sh
npm install -g altv-installer
```

## Use with Command Line

You should be running this in your base server directory where `package.json` is.

If you don't have a package.json do `npm init`.

Also make sure to create a folder called `resources`.

```sh
altv-install <author>/<reponame>
```

ie. `altv-install stuyk/altv-discord-auth`

If the repo is `NOT` supported it will tell you.

<br />

# Resource Creators

If you wish to add support to your resource for this file. Please add `.altv` file to your repository with installation instructions. You can also specify `[]` inside of your `.altv` file to skip all instructions.

## Instruction Types

### package

Installs an npm package automatically.

### question

Ask a question for the user to respond to in the comnand line.

Responses are recorded to `resources/<your_repo>/responses.json`

### postinstall

Specify a script for node to run at the end of the script.

This file should be located in your repository.

<br />

# Instructions Example

Here is a baseline example of your `.altv` file could look.

```json
[
    {
        "type": "package",
        "name": "sjcl",
        "version": "latest"
    },
    {
        "type": "question",
        "question": "What is your favorite color?"
    },
    {
        "type": "postinstall",
        "file": "post.js"
    }
]
```

### Explanation

1. Add `sjcl` to `package.json` dependencies.
2. Ask the user a question and store the response in `responses.json`
3. Run a `postinstall` script called `post.js` with NodeJS.

<br />

# Author

Created by Stuyk (Trevor Wessel)

❤️ Please support my open source work by donating. I'm here to provide general context for complicated procedures for you new developers. ❤️

https://github.com/sponsors/Stuyk/

❤️ Want direct support for my scripts and tutoring? Check out my Patreon.

https://patreon.com/stuyk

⭐ This repository if you found it useful!

<br />

# Cat Tax

![](https://i.imgur.com/RTeHeQH.jpeg)
