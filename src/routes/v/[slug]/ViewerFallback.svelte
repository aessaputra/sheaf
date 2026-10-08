<script lang="ts">
	import { CaretDownIcon, MinusCircleIcon, PlusCircleIcon } from 'phosphor-svelte';
	let {
		streamUrl,
		fileName,
		errorMessage
	}: {
		streamUrl: string;
		fileName: string;
		errorMessage?: string;
	} = $props();
</script>

<div class="fallback">
	<div class="toolbar">
		<div class="zoom" aria-label="Zoom controls loading" role="group">
			<span class="percentage" aria-hidden="true">—%</span>
			<button disabled aria-label="Zoom presets"><CaretDownIcon size={20} /></button>
			<button disabled aria-label="Zoom out"><MinusCircleIcon size={20} /></button>
			<button disabled aria-label="Zoom in"><PlusCircleIcon size={20} /></button>
		</div>
		<a href={streamUrl} download={fileName}>Download</a>
	</div>
	<p role={errorMessage ? 'alert' : 'status'}>{errorMessage ?? 'Loading…'}</p>
</div>

<style>
	.fallback {
		height: 100%;
		background: #f3f4f6;
		container-type: inline-size;
	}
	.toolbar {
		display: flex;
		align-items: center;
		height: 3rem;
		box-sizing: border-box;
		padding: 0.5rem 1rem;
		border-bottom: 1px solid #e5e7eb;
		background: white;
		font-size: 0.875rem;
	}
	.zoom {
		display: flex;
		align-items: center;
		gap: 0.125rem;
		background: #f3f4f6;
		border-radius: 6px;
		padding-right: 0.25rem;
	}
	.percentage {
		width: 3.25rem;
		text-align: right;
		color: #9ca3af;
	}
	button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		color: #9ca3af;
		border: 0;
		background: transparent;
		border-radius: 6px;
	}
	a {
		display: inline-flex;
		align-items: center;
		height: 2rem;
		padding: 0 0.75rem;
		margin-left: auto;
		color: #111827;
		white-space: nowrap;
	}
	a:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: 2px;
	}
	p {
		margin: 0;
		padding: 2rem;
		text-align: center;
	}
	@container (max-width: 40rem) {
		.toolbar {
			padding-inline: 0.75rem;
		}
	}
	@container (max-width: 25rem) {
		.percentage {
			display: none;
		}
		.zoom {
			background: transparent;
			padding-right: 0;
		}
	}
</style>
