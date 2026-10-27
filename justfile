default: check test

check: build
    pnpm run check

fmt:
    pnpm exec prettier --write "src/**/*.{js,jsx,css}" "tests/**/*.mjs" "scripts/**/*.mjs" "*.{json,md,yml}"

test:
    pnpm test

build:
    pnpm run build

dev: build
    dsh plugin --profile web add "link:$PWD"
    pnpm exec concurrently -k -n watch,dsh -c cyan,green "pnpm run watch" "dsh web"
