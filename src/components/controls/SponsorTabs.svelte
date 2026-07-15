<script lang="ts">
import Icon from "@/components/common/Icon.svelte";
import { url } from "@/utils/url-utils";
import { onMount } from "svelte";

interface SponsorMethod {
	name: string;
	icon?: string;
	qrCode?: string;
	link?: string;
	description?: string;
}

interface Props {
	enabledMethods: SponsorMethod[];
}

let { enabledMethods }: Props = $props();
let activeIndex = $state(0);
let navRef = $state<HTMLElement | null>(null);
let indicatorRef = $state<HTMLElement | null>(null);

function updateIndicator() {
	if (!navRef || !indicatorRef) return;
	const activeBtn = navRef.querySelector(
		`[data-sponsor-tab="${activeIndex}"]`,
	) as HTMLElement | null;
	if (!activeBtn) return;
	const navRect = navRef.getBoundingClientRect();
	const btnRect = activeBtn.getBoundingClientRect();
	indicatorRef.style.left = `${btnRect.left - navRect.left}px`;
	indicatorRef.style.top = `${btnRect.top - navRect.top}px`;
	indicatorRef.style.width = `${btnRect.width}px`;
	indicatorRef.style.height = `${btnRect.height}px`;
	indicatorRef.style.opacity = "1";
}

function setActiveIndex(index: number) {
	activeIndex = index;
	requestAnimationFrame(updateIndicator);
}

onMount(() => {
	requestAnimationFrame(updateIndicator);

	const onResize = () => updateIndicator();
	window.addEventListener("resize", onResize);
	return () => window.removeEventListener("resize", onResize);
});
</script>

{#if enabledMethods.length > 0}
	<div class="sponsor-qr-card__outer">
		<div class="sponsor-qr-card">
			<!-- 第一层：扫码赞助标题 -->
			<div class="sponsor-qr-card__header">
				<h3 class="sponsor-qr-card__title">扫码赞助</h3>
			</div>

			<!-- 第二层：选择支付方式 -->
			<p class="sponsor-qr-card__subtitle">选择你喜欢的赞助方式</p>

			<!-- 第三层：Tabs 导航 -->
			<div class="sponsor-qr-card__tabs-wrapper">
				<div class="sponsor-qr-card__tabs-pill" bind:this={navRef}>
					<div class="sponsor-qr-card__tabs-indicator" bind:this={indicatorRef}></div>
					{#each enabledMethods as method, index (method.name)}
						<button
							class="sponsor-qr-card__tab-btn"
							class:sponsor-qr-card__tab-btn--active={activeIndex === index}
							class:sponsor-qr-card__tab-btn--inactive={activeIndex !== index}
							data-sponsor-tab={index}
							type="button"
							onclick={() => setActiveIndex(index)}
						>
							{#if method.icon}
								<Icon icon={method.icon} class="text-[1rem]" />
							{/if}
							{method.name}
						</button>
					{/each}
				</div>
			</div>

			<!-- 第四层：内容区 -->
			<div class="sponsor-qr-card__content">
				{#each enabledMethods as method, index (method.name)}
					<div
						class="sponsor-qr-card__panel"
						class:hidden={activeIndex !== index}
						data-sponsor-panel={index}
					>
						{#if method.link}
							<div class="sponsor-link-card">
								<h2 class="sponsor-link-card__title">{method.name}</h2>
								<p class="sponsor-link-card__desc">
									{method.description || `通过 ${method.name} 进行赞助`}
								</p>
								<a
									href={method.link}
									target="_blank"
									rel="noopener noreferrer"
									class="sponsor-link-card__btn"
								>
									前往赞助
									<Icon icon="material-symbols:open-in-new" class="text-lg" />
								</a>
							</div>
						{:else if method.qrCode}
							<div class="flex flex-col items-center">
								<div class="sponsor-qr-card__image-wrapper">
									<img
										src={url(method.qrCode)}
										alt={`${method.name} 扫码赞助`}
										class="sponsor-qr-card__image"
										loading="lazy"
									/>
									</div>
								{#if method.description}
									<p class="sponsor-qr-card__desc">{method.description}</p>
								{/if}
							</div>
						{:else}
							<div class="sponsor-qr-card__empty">
								<Icon icon="material-symbols:qr-code-scanner" class="text-[3rem] mb-2 opacity-40" />
								<span class="sponsor-qr-card__empty-text">暂不开通</span>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}
