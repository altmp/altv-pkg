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

```
{
    "loadBytecodeModule": true
}
```
