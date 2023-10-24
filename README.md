# altv-pkg

![](https://i.imgur.com/XgO9FzQ.png)

Download server binaries quickly and easily for [alt:V Servers](https://altv.mp).

| Usage              | Description                      |
| ------------------ | -------------------------------- |
| `altv-pkg release` | Download latest release binaries |
| `altv-pkg rc`      | Download latest rc binaries      |
| `altv-pkg dev`     | Download latest dev binaries     |

## How to install?

```
npm i --save-dev altv-pkg
```

## How to run?

```
npx altv-pkg release
```

## Configuration

Create a `.altvpkgrc.json` file in your root directory and add the following JSON code.

**Note:** The `loadJSV2Module` configuration allows you to include the experimental JavaScript V2 (JSV2) module when downloading binaries. Please be aware that as of the current release, the JSV2 module is exclusively available in the dev branch.

**Note** The `loadVoiceServer` configuration allows you to include [external voice server](https://docs.altv.mp/articles/external_voice_server.html) when downloading binaries.

```
{
    "loadBytecodeModule": true,
    "loadCSharpModule": true,
    "loadJSV2Module": true,
    "loadVoiceServer": true
}
```
