<span align="center">

# Compressarr

</span>

<img src="https://media.giphy.com/media/10l79ICohTu4iQ/giphy.gif" align="right" alt="Unlocking Door">

**Compressarr** is a lightweight NodeJS server you can run that provides transcode automation. It supports Plugins, which are community-contributed modules that provide basic actions to transcode media.

You can explore all available plugins at the yarn website by [searching for the keyword `compressarr-plugin`](https://yarnpkg.com/?q=compressarr-plugin).

## Installation

Ensure you have **Node.js v10.17.0** or later installed and run:

```shell
sudo yarn global add compressarr
```

Then start Homebridge in your terminal window by running:

```shell
compressarr
```

## Installing Plugins

Plugins are Node.js modules published through yarn and tagged with the keyword `compressarr-plugin`. They must have a name with the prefix `compressarr-`, like **compressarr-compressor**.

Plugins can publish Job Actions. Job Actions are individual transcode actions.

You install Plugins using the same way you installed Compressarr - as a global NPM module. For example:

```shell
sudo yarn global add compressarr-dummy
```

You can explore all available plugins at the yarn website by [searching for the keyword `compressarr-plugin`](https://yarnpkg.com/?q=compressarr-plugin).

## Plugin Development

When writing your plugin, you'll want Compressarr to load it from your development directory instead of publishing it to `yarn` each time. Run this command inside your plugin project folder so your global install of Compressarr can discover it:


```shell
yarn link
```

*You can undo this using the `yarn unlink` command.*

Then start Compressarr in debug mode:

```shell
compressarr -D
```

This will start up Compressarr and load your in-development plugin. Note that you can also direct Compressarr to load your configuration from somewhere besides the default `~/.compressarr`, for example:

```shell
compressarr -D -U ~/.compressarr-dev
```

This is very useful when you are already using your development machine to host a "real" Compressarr instance (with all your job actions) that you don't want to disturb.
