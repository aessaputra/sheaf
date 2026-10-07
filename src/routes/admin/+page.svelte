<script lang="ts">
	import type { PageData } from './$types';
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client as zodClient } from 'sveltekit-superforms/adapters';
	import { toast, Toaster } from 'svelte-sonner';
	import { SignOut } from 'phosphor-svelte';
	import { goto } from '$app/navigation';
	import { loginSchema } from '#lib/login-schema.ts';
	import UploadCard from '#lib/components/UploadCard.svelte';
	import FileRow, { type FileEntry } from '#lib/components/FileRow.svelte';

	let { data }: { data: PageData } = $props();

	const { form, errors, enhance } = superForm(data.form, {
		validators: zodClient(loginSchema),
		resetForm: false,
		onSubmit: async ({ formData, cancel }) => {
			cancel();
			loggingIn = true;
			try {
				const res = await fetch('/api/login', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ password: formData.get('password') })
				});
				if (!res.ok) {
					toast.error('Invalid credentials.');
					return;
				}
				authed = true;
			} finally {
				loggingIn = false;
			}
		}
	});

	let loggingIn = $state(false);

	let authed = $state(data.authed);
	let files = $state<FileEntry[]>([]);
	let loading = $state(data.authed);

	async function loadFiles() {
		loading = true;
		try {
			const res = await fetch('/api/files');
			if (res.status === 401) {
				authed = false;
				return;
			}
			if (!res.ok) throw 0;
			files = ((await res.json()) as { files: FileEntry[] }).files ?? [];
		} catch {
			toast.error('Could not load files.');
		} finally {
			loading = false;
		}
	}

	async function handleDelete(slug: string) {
		const res = await fetch(`/api/files/${slug}`, { method: 'DELETE' });
		if (!res.ok) {
			toast.error('Delete failed.');
			return;
		}
		files = files.filter((f) => f.slug !== slug);
		toast.success('File deleted.');
	}

	async function logout() {
		await fetch('/api/logout', { method: 'POST' });
		authed = false;
		files = [];
		goto('/');
	}

	$effect(() => {
		if (authed) loadFiles();
	});
</script>

<Toaster position="bottom-center" />

<main class="mx-auto max-w-4xl px-6 py-24">
	{#if !authed}
		<h1
			class="text-4xl leading-[1.1] tracking-[-0.03em] text-[#111111]"
			style="font-family: 'Instrument Serif', Georgia, serif;"
		>
			Admin
		</h1>
		<p class="mt-4 max-w-xl text-base leading-[1.6] text-[#2F3437]">
			Enter the password to manage files.
		</p>

		<form
			method="POST"
			use:enhance
			class="mt-10 max-w-sm rounded-[12px] border border-[#EAEAEA] bg-white p-6 sm:p-8"
		>
			<label for="password" class="block text-sm font-medium text-[#111111]">Password</label>
			<input
				id="password"
				name="password"
				type="password"
				autocomplete="current-password"
				bind:value={$form.password}
				class="mt-2 w-full rounded-[6px] border border-[#EAEAEA] bg-[#FBFBFA] px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#787774]"
			/>
			{#if $errors.password}
				<p class="mt-2 text-sm text-[#9F2F2D]">{$errors.password}</p>
			{/if}
			<button
				type="submit"
				disabled={loggingIn}
				class="mt-6 w-full rounded-[5px] bg-[#111111] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[#333333] active:scale-[0.98] disabled:opacity-50"
			>
				{loggingIn ? 'Signing in…' : 'Sign in'}
			</button>
		</form>
	{:else}
		<div class="flex items-baseline justify-between gap-4">
			<h1
				class="text-4xl leading-[1.1] tracking-[-0.03em] text-[#111111]"
				style="font-family: 'Instrument Serif', Georgia, serif;"
			>
				Files
			</h1>
			<button
				type="button"
				onclick={logout}
				class="inline-flex items-center gap-1.5 text-sm text-[#787774] transition-colors hover:text-[#111111]"
			>
				<SignOut size={16} />
				Sign out
			</button>
		</div>

		<div class="mt-10">
			<UploadCard onuploaded={loadFiles} />
		</div>

		<section class="mt-8 rounded-[12px] border border-[#EAEAEA] bg-white p-6 sm:p-8">
			<h2 class="text-lg font-semibold text-[#111111]">All files</h2>
			{#if loading}
				<p class="mt-4 text-sm text-[#787774]">Loading…</p>
			{:else if files.length === 0}
				<p class="mt-4 text-sm leading-[1.6] text-[#787774]">No files yet. Upload one above.</p>
			{:else}
				<ul class="mt-2">
					{#each files as file (file.slug)}
						<FileRow {file} ondelete={handleDelete} />
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</main>
