const color = [
  "primary",
  "indigo",
  "emerald",
  "amber",
  "purple",
  "neutral"
] as const

const size = [
  "xs",
  "sm",
  "md",
  "lg",
  "xl"
] as const

const variant = [
  "outline",
  "soft",
  "subtle",
  "ghost",
  "none"
] as const

const orientation = [
  "horizontal",
  "vertical"
] as const

export default {
  "slots": {
    "root": "relative inline-flex items-center",
    "base": [
      "w-full rounded-md border-0 placeholder:text-dimmed focus:outline-none disabled:cursor-not-allowed disabled:opacity-75",
      "transition-colors"
    ],
    "increment": "absolute flex items-center",
    "decrement": "absolute flex items-center"
  },
  "variants": {
    "fieldGroup": {
      "horizontal": {
        "root": "group has-focus-visible:z-[1]",
        "base": "group-not-only:group-first:rounded-e-none group-not-only:group-last:rounded-s-none group-not-last:group-not-first:rounded-none"
      },
      "vertical": {
        "root": "group has-focus-visible:z-[1]",
        "base": "group-not-only:group-first:rounded-b-none group-not-only:group-last:rounded-t-none group-not-last:group-not-first:rounded-none"
      }
    },
    "color": {
      "primary": "",
      "indigo": "",
      "emerald": "",
      "amber": "",
      "purple": "",
      "neutral": ""
    },
    "size": {
      "xs": "px-2 py-1 text-xs gap-1",
      "sm": "px-2.5 py-1.5 text-xs gap-1.5",
      "md": "px-2.5 py-1.5 text-sm gap-1.5",
      "lg": "px-3 py-2 text-sm gap-2",
      "xl": "px-3 py-2 text-base gap-2"
    },
    "variant": {
      "outline": "text-highlighted bg-default ring ring-inset ring-accented",
      "soft": "text-highlighted bg-elevated/50 hover:bg-elevated focus:bg-elevated disabled:bg-elevated/50",
      "subtle": "text-highlighted bg-elevated ring ring-inset ring-accented",
      "ghost": "text-highlighted bg-transparent hover:bg-elevated focus:bg-elevated disabled:bg-transparent dark:disabled:bg-transparent",
      "none": "text-highlighted bg-transparent"
    },
    "disabled": {
      "true": {
        "increment": "opacity-75 cursor-not-allowed",
        "decrement": "opacity-75 cursor-not-allowed"
      }
    },
    "orientation": {
      "horizontal": {
        "base": "text-center",
        "increment": "inset-y-0 end-0 pe-1",
        "decrement": "inset-y-0 start-0 ps-1"
      },
      "vertical": {
        "increment": "top-0 end-0 pe-1 [&>button]:py-0 scale-80",
        "decrement": "bottom-0 end-0 pe-1 [&>button]:py-0 scale-80"
      }
    },
    "highlight": {
      "true": ""
    },
    "increment": {
      "false": ""
    },
    "decrement": {
      "false": ""
    }
  },
  "compoundVariants": [
    {
      "color": "primary" as typeof color[number],
      "variant": [
        "outline" as typeof variant[number],
        "subtle" as typeof variant[number]
      ],
      "class": "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
    },
    {
      "color": "indigo" as typeof color[number],
      "variant": [
        "outline" as typeof variant[number],
        "subtle" as typeof variant[number]
      ],
      "class": "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo"
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": [
        "outline" as typeof variant[number],
        "subtle" as typeof variant[number]
      ],
      "class": "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald"
    },
    {
      "color": "amber" as typeof color[number],
      "variant": [
        "outline" as typeof variant[number],
        "subtle" as typeof variant[number]
      ],
      "class": "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber"
    },
    {
      "color": "purple" as typeof color[number],
      "variant": [
        "outline" as typeof variant[number],
        "subtle" as typeof variant[number]
      ],
      "class": "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple"
    },
    {
      "color": "primary" as typeof color[number],
      "highlight": true,
      "class": "ring ring-inset ring-primary"
    },
    {
      "color": "indigo" as typeof color[number],
      "highlight": true,
      "class": "ring ring-inset ring-indigo"
    },
    {
      "color": "emerald" as typeof color[number],
      "highlight": true,
      "class": "ring ring-inset ring-emerald"
    },
    {
      "color": "amber" as typeof color[number],
      "highlight": true,
      "class": "ring ring-inset ring-amber"
    },
    {
      "color": "purple" as typeof color[number],
      "highlight": true,
      "class": "ring ring-inset ring-purple"
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": [
        "outline" as typeof variant[number],
        "subtle" as typeof variant[number]
      ],
      "class": "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-inverted"
    },
    {
      "color": "neutral" as typeof color[number],
      "highlight": true,
      "class": "ring ring-inset ring-inverted"
    },
    {
      "orientation": "horizontal" as typeof orientation[number],
      "decrement": false,
      "class": "text-start"
    },
    {
      "decrement": true,
      "size": "xs" as typeof size[number],
      "class": "ps-7"
    },
    {
      "decrement": true,
      "size": "sm" as typeof size[number],
      "class": "ps-8"
    },
    {
      "decrement": true,
      "size": "md" as typeof size[number],
      "class": "ps-9"
    },
    {
      "decrement": true,
      "size": "lg" as typeof size[number],
      "class": "ps-10"
    },
    {
      "decrement": true,
      "size": "xl" as typeof size[number],
      "class": "ps-11"
    },
    {
      "increment": true,
      "size": "xs" as typeof size[number],
      "class": "pe-7"
    },
    {
      "increment": true,
      "size": "sm" as typeof size[number],
      "class": "pe-8"
    },
    {
      "increment": true,
      "size": "md" as typeof size[number],
      "class": "pe-9"
    },
    {
      "increment": true,
      "size": "lg" as typeof size[number],
      "class": "pe-10"
    },
    {
      "increment": true,
      "size": "xl" as typeof size[number],
      "class": "pe-11"
    }
  ],
  "defaultVariants": {
    "size": "md" as typeof size[number],
    "color": "primary" as typeof color[number],
    "variant": "outline" as typeof variant[number]
  }
}