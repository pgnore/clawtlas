const color = [
  "primary",
  "indigo",
  "emerald",
  "amber",
  "purple",
  "neutral"
] as const

export default {
  "slots": {
    "root": [
      "relative z-50 w-full",
      "transition-colors"
    ],
    "container": "flex items-center justify-between gap-3 h-12",
    "left": "hidden lg:flex-1 lg:flex lg:items-center",
    "center": "flex items-center gap-1.5 min-w-0",
    "right": "lg:flex-1 flex items-center justify-end",
    "icon": "size-5 shrink-0 text-inverted pointer-events-none",
    "title": "text-sm text-inverted font-medium truncate",
    "actions": "flex gap-1.5 shrink-0 isolate",
    "close": "text-inverted hover:bg-default/10 focus-visible:bg-default/10 -me-1.5 lg:me-0"
  },
  "variants": {
    "color": {
      "primary": {
        "root": "bg-primary"
      },
      "indigo": {
        "root": "bg-indigo"
      },
      "emerald": {
        "root": "bg-emerald"
      },
      "amber": {
        "root": "bg-amber"
      },
      "purple": {
        "root": "bg-purple"
      },
      "neutral": {
        "root": "bg-inverted"
      }
    },
    "to": {
      "true": ""
    }
  },
  "compoundVariants": [
    {
      "color": "primary" as typeof color[number],
      "to": true,
      "class": {
        "root": "hover:bg-primary/90"
      }
    },
    {
      "color": "indigo" as typeof color[number],
      "to": true,
      "class": {
        "root": "hover:bg-indigo/90"
      }
    },
    {
      "color": "emerald" as typeof color[number],
      "to": true,
      "class": {
        "root": "hover:bg-emerald/90"
      }
    },
    {
      "color": "amber" as typeof color[number],
      "to": true,
      "class": {
        "root": "hover:bg-amber/90"
      }
    },
    {
      "color": "purple" as typeof color[number],
      "to": true,
      "class": {
        "root": "hover:bg-purple/90"
      }
    },
    {
      "color": "neutral" as typeof color[number],
      "to": true,
      "class": {
        "root": "hover:bg-inverted/90"
      }
    }
  ],
  "defaultVariants": {
    "color": "primary" as typeof color[number]
  }
}