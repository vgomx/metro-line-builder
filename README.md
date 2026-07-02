# metro-line-builder

Interactive web app for creating and editing metro/transit maps. React + TypeScript + Vite.

## Setup

This app depends on [`metro-ds`](https://github.com/vgomx/metro-ds) as a local `file:` dependency, so it expects `metro-ds` to be checked out as a sibling directory:

```
some-folder/
├── metro-line-builder/   (this repo)
└── metro-ds/
```

```sh
# in metro-ds/
npm install && npm run build

# in metro-line-builder/
npm install
npm run dev
```

Once `metro-ds` stabilizes, publish it (npm or GitHub Packages) and swap the `file:` dependency for a versioned one.
