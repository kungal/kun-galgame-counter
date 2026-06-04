<template>
  <div class="ren" />
  <div class="page">
    <div class="card">
      <p class="kun">
        <img src="/favicon.ico" alt="" />
        鲲 Galgame 正在临时下线维护中...
      </p>
      <h1>莲是可爱的孩子吗？</h1>
      <a
        href="https://s.iloveren.link/s/moyumoe2"
        target="_blank"
        class="subtitle"
      >
        莲真的是我遇见最好的女孩子, 想和她结婚天长地久恩恩爱爱百年好合,
        想和她翻云覆雨、干湿分离、水乳交融、干柴烈火,
        日日夜夜每时每刻每个开心难过七滋八味苦辣麻香咸的日子里都在想念、挚爱、铭记着莲,
        你们懂这种心情吗！！！这已经不是爱了, 这种东西叫本能,
        我只是本能的爱着这个孩子而已, 我无法控制自己的本能, 我已经病入膏肓了,
        病名为莲。
      </a>

      <div class="count-panel" />

      <p>{{ pending ? '...' : total }} 人觉得莲最可爱了, 你觉得莲可爱吗？</p>
      <div class="options">
        <button
          v-for="option in options"
          :key="option.value"
          class="option"
          :class="{ 'option-active': selectedValue === option.value }"
          :disabled="pending || loading || hasClicked"
          @click="handleSelect(option)"
        >
          <span class="option-main">
            <span class="option-label">{{ option.label }}</span>
            <span class="option-count">
              {{ optionCounts[option.value] ?? 0 }} 票 ·
              {{ optionPercent(option.value) }}%
            </span>
          </span>
          <span class="option-bar">
            <span
              class="option-bar-fill"
              :style="{ width: optionPercent(option.value) + '%' }"
            />
          </span>
          <span class="option-desc">{{ option.description }}</span>
        </button>
      </div>

      <p v-if="selectedLabel" class="selection">
        你选择了「{{ selectedLabel }}」。
      </p>

      <p v-if="message" class="message">
        {{ message }}
      </p>

      <a
        class="github"
        href="https://github.com/kungal"
        target="_blank"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="1em"
          height="1em"
          viewBox="0 0 24 24"
        >
          <path
            fill="currentColor"
            d="M12 2.247a10 10 0 0 0-3.162 19.487c.5.088.687-.212.687-.475c0-.237-.012-1.025-.012-1.862c-2.513.462-3.163-.613-3.363-1.175a3.64 3.64 0 0 0-1.025-1.413c-.35-.187-.85-.65-.013-.662a2 2 0 0 1 1.538 1.025a2.137 2.137 0 0 0 2.912.825a2.1 2.1 0 0 1 .638-1.338c-2.225-.25-4.55-1.112-4.55-4.937a3.9 3.9 0 0 1 1.025-2.688a3.6 3.6 0 0 1 .1-2.65s.837-.262 2.75 1.025a9.43 9.43 0 0 1 5 0c1.912-1.3 2.75-1.025 2.75-1.025a3.6 3.6 0 0 1 .1 2.65a3.87 3.87 0 0 1 1.025 2.688c0 3.837-2.338 4.687-4.562 4.937a2.37 2.37 0 0 1 .674 1.85c0 1.338-.012 2.413-.012 2.75c0 .263.187.575.687.475A10.005 10.005 0 0 0 12 2.247"
          />
        </svg>
        <span>GitHub 仓库</span>
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({
  title: '莲是世界上最可爱的孩子!',
  htmlAttrs: { lang: 'zh-CN' },
})

// This is a maintenance page. Respond with 503 + Retry-After so search engines
// treat the downtime as temporary instead of deindexing the real site.
if (import.meta.server) {
  const event = useRequestEvent()
  if (event) {
    setResponseStatus(event, 503)
    event.node.res.setHeader('Retry-After', '3600')
  }
}

type VoteOption = {
  value: string
  label: string
  description: string
}

const options: VoteOption[] = [
  {
    value: 'cute',
    label: '可爱',
    description: '想和她结婚天长地久恩恩爱爱百年好合',
  },
  {
    value: 'adorable',
    label: '萌',
    description: '想和她翻云覆雨、干湿分离、水乳交融、干柴烈火',
  },
  {
    value: 'both',
    label: '又可爱又萌',
    description:
      '日日夜夜每时每刻每个开心难过七滋八味苦辣麻香咸的日子里都在想念、挚爱、铭记着莲',
  },
]

const { data, pending, error } = useFetch('/api/counter', {
  default: () => ({
    total: 0,
    options: { cute: 0, adorable: 0, both: 0 },
    clicked: false,
    selected: null as string | null,
  }),
})

const loading = ref(false)
const message = ref('')

const total = computed(() => data.value?.total ?? 0)
const hasClicked = computed(() => Boolean(data.value?.clicked))
const optionCounts = computed<Record<string, number>>(
  () => (data.value?.options as Record<string, number>) ?? {}
)
const selectedValue = computed(() => data.value?.selected ?? '')
const selectedLabel = computed(
  () => options.find((option) => option.value === selectedValue.value)?.label ?? ''
)

const optionPercent = (value: string) => {
  if (!total.value) {
    return 0
  }
  return Math.round(((optionCounts.value[value] ?? 0) / total.value) * 100)
}

watch(error, (err) => {
  if (err) {
    message.value = '莲的计数器暂时不可用, 请稍后再选择可爱的莲!!!'
  }
})

const handleSelect = async (option: VoteOption) => {
  if (pending.value || loading.value || hasClicked.value) {
    if (hasClicked.value) {
      message.value = '当前 IP 已经表达过对莲的爱意了!!!'
    }
    return
  }

  loading.value = true
  message.value = ''

  try {
    const result = await $fetch('/api/counter', {
      method: 'POST',
      body: { option: option.value },
    })

    data.value = result
    message.value = '最喜欢莲了!!!'
  } catch (err) {
    console.error(err)
    message.value = '提交失败'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
:global(*),
:global(*::before),
:global(*::after) {
  box-sizing: border-box;
}

:global(body) {
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
    'Microsoft YaHei', sans-serif;
  margin: 0;
  color: #2f2c35;
}

.kun {
  font-size: 14px;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #5d5a68;
}

.kun img {
  border-radius: 16px;
  width: 16px;
  margin-right: 8px;
}

.ren {
  position: fixed;
  height: 100%;
  width: 100%;
  background: url('/bg.avif');
  background-position: 50%;
  background-repeat: no-repeat;
  background-attachment: fixed;
  background-size: cover;
  opacity: 25%;
}

.page {
  display: grid;
  place-items: center;
  min-height: 90dvh;
  padding: 3rem 1rem;
}

.card {
  width: min(640px, 100%);
  background: rgba(255, 255, 255, 0.3);
  padding: clamp(2rem, 4vw, 3rem);
  backdrop-filter: blur(6px);
  text-align: center;
}

h1 {
  margin: 0 0 0.9rem;
  font-size: clamp(2rem, 5vw, 2.6rem);
  color: #2f2c35;
}

.subtitle {
  color: #5d5a68;
  line-height: 1.6;
  text-decoration: none;
}

.count-panel {
  margin-top: 2rem;
  background: #0070f015;
  padding: 1.75rem;
  margin-bottom: 1.75rem;
  background: url('/ren.avif');
  background-position: 50%;
  background-repeat: no-repeat;
  background-size: cover;
  min-height: 16rem;
}

.options {
  display: flex;
  flex-direction: column;
}

.option {
  border: none;
  padding: 1.1rem 1.2rem;
  background: #0070f015;
  text-align: left;
  cursor: pointer;
  color: #2f2c35;
  margin-bottom: 1rem;
}

.option:hover {
  background: #0070f025;
}

.option:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.option-active {
  outline: 2px solid #0070f0;
  outline-offset: -2px;
}

.option-main {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}

.option-label {
  font-size: 1.1rem;
  font-weight: 600;
  color: #3c3a43;
}

.option-count {
  flex-shrink: 0;
  color: #4c5a86;
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
}

.option-bar {
  display: block;
  margin-top: 0.6rem;
  height: 4px;
  border-radius: 2px;
  background: #0070f01a;
  overflow: hidden;
}

.option-bar-fill {
  display: block;
  height: 100%;
  border-radius: 2px;
  background: #0070f0;
  transition: width 0.4s ease;
}

.option-desc {
  display: block;
  margin-top: 0.45rem;
  color: #6c6a78;
  font-size: 0.9rem;
}

.selection {
  margin: 0.5rem 0 0;
  color: #4c5a86;
  font-weight: 600;
}

.message {
  margin: 0.4rem 0 0.6rem;
  color: #f26f91;
  font-weight: 500;
}

.github {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #2f2c35;
  margin-top: 2rem;
}

.github svg {
  margin-right: 4px;
}
</style>
