const color = [
  "primary",
  "indigo",
  "emerald",
  "amber",
  "purple",
  "neutral"
] as const

const variant = [
  "solid",
  "outline",
  "soft",
  "subtle"
] as const

const size = [
  "sm",
  "md",
  "lg"
] as const

export default {
  "base": "inline-flex items-center justify-center px-1 rounded-sm font-medium font-sans uppercase",
  "variants": {
    "color": {
      "primary": "",
      "indigo": "",
      "emerald": "",
      "amber": "",
      "purple": "",
      "neutral": ""
    },
    "variant": {
      "solid": "",
      "outline": "",
      "soft": "",
      "subtle": ""
    },
    "size": {
      "sm": "h-4 min-w-[16px] text-[10px]",
      "md": "h-5 min-w-[20px] text-[11px]",
      "lg": "h-6 min-w-[24px] text-[12px]"
    }
  },
  "compoundVariants": [
    {
      "color": "primary" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-primary"
    },
    {
      "color": "indigo" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-indigo"
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-emerald"
    },
    {
      "color": "amber" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-amber"
    },
    {
      "color": "purple" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-purple"
    },
    {
      "color": "primary" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-primary/50 text-primary"
    },
    {
      "color": "indigo" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-indigo/50 text-indigo"
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-emerald/50 text-emerald"
    },
    {
      "color": "amber" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-amber/50 text-amber"
    },
    {
      "color": "purple" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-purple/50 text-purple"
    },
    {
      "color": "primary" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-primary bg-primary/10"
    },
    {
      "color": "indigo" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-indigo bg-indigo/10"
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-emerald bg-emerald/10"
    },
    {
      "color": "amber" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-amber bg-amber/10"
    },
    {
      "color": "purple" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-purple bg-purple/10"
    },
    {
      "color": "primary" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-primary ring ring-inset ring-primary/25 bg-primary/10"
    },
    {
      "color": "indigo" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-indigo ring ring-inset ring-indigo/25 bg-indigo/10"
    },
    {
      "color": "emerald" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-emerald ring ring-inset ring-emerald/25 bg-emerald/10"
    },
    {
      "color": "amber" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-amber ring ring-inset ring-amber/25 bg-amber/10"
    },
    {
      "color": "purple" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-purple ring ring-inset ring-purple/25 bg-purple/10"
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-inverted"
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-accented text-default bg-default"
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-default bg-elevated"
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "ring ring-inset ring-accented text-default bg-elevated"
    }
  ],
  "defaultVariants": {
    "variant": "outline" as typeof variant[number],
    "color": "neutral" as typeof color[number],
    "size": "md" as typeof size[number]
  }
}