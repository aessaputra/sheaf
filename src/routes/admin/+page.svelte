<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';
	import { toast, Toaster } from 'svelte-sonner';
	import { SignOutIcon } from 'phosphor-svelte';
	import { goto } from '$app/navigation';
	import UploadCard from '#lib/components/UploadCard.svelte';
	import FileRow from '#lib/components/FileRow.svelte';
	import type { FileEntry } from '#lib/server/admin-files.ts';

	let { data }: PageProps = $props();

	let password = $state('');

	let loggingIn = $state(false);

	// svelte-ignore state_referenced_locally (initial auth snapshot; updated explicitly on login/logout/401)
	let authed = $state(data.authed);
	// svelte-ignore state_referenced_locally (SSR initial list snapshot; refreshed explicitly via loadFiles)
	let files = $state<FileEntry[]>(data.initialFiles ?? []);
	let loading = $state(false);
	let loadError = $state<string | null>(null);
	let loggingOut = $state(false);
	let loadGeneration = 0;

	function invalidateLoads() {
		loadGeneration++;
		loading = false;
		loadError = null;
	}

	function goToLogin(message?: string) {
		invalidateLoads();
		authed = false;
		files = [];
		if (message) toast.error(message);
	}

	async function loadFiles() {
		if (!authed || loggingOut) return;
		const generation = ++loadGeneration;
		loading = true;
		loadError = null;
		try {
			const res = await fetch('/api/files');
			if (generation !== loadGeneration) return;
			if (res.status === 401) {
				goToLogin('Session expired. Please sign in again.');
				return;
			}
			if (!res.ok) throw new Error(`Load failed (${res.status}).`);
			const body = (await res.json()) as { files: FileEntry[] };
			if (generation === loadGeneration) files = body.files ?? [];
		} catch (err) {
			if (generation === loadGeneration)
				loadError = err instanceof Error ? err.message : 'Could not load files.';
		} finally {
			if (generation === loadGeneration) loading = false;
		}
	}

	async function handleLogin(event: SubmitEvent) {
		event.preventDefault();
		if (!password) return;
		loggingIn = true;
		try {
			const res = await fetch('/api/login', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ password })
			});
			if (!res.ok) {
				toast.error(
					res.status === 429
						? 'Too many attempts. Please try again in a minute.'
						: res.status === 401
							? 'Invalid credentials.'
							: 'Sign in is unavailable. Please try again.'
				);
				return;
			}
			authed = true;
			password = '';
			await loadFiles();
		} catch {
			toast.error('Network error. Please try again.');
		} finally {
			loggingIn = false;
		}
	}

	async function handleDelete(slug: string) {
		const target = files.find((f) => f.slug === slug);
		const confirmed = await new Promise<boolean>((resolve) => {
			toast('Delete this file?', {
				description: `${target?.fileName ?? slug} · This cannot be undone.`,
				duration: Infinity,
				action: { label: 'Delete', onClick: () => resolve(true) },
				cancel: { label: 'Cancel', onClick: () => resolve(false) },
				onDismiss: () => resolve(false)
			});
		});
		if (!confirmed || !authed || loggingOut) return;
		let res: Response;
		try {
			res = await fetch(`/api/files/${slug}`, { method: 'DELETE' });
		} catch {
			toast.error('Could not confirm deletion. Please retry.');
			return;
		}
		if (res.status === 401) {
			goToLogin('Session expired. Please sign in again.');
			return;
		}
		if (!res.ok) {
			const body = (await res.json().catch(() => null)) as { message?: string } | null;
			toast.error(body?.message ?? 'Deletion failed. Please retry.');
			return;
		}
		invalidateLoads();
		files = files.filter((f) => f.slug !== slug);
		toast.success('File deleted.');
	}

	async function logout() {
		if (loggingOut) return;
		loggingOut = true;
		invalidateLoads();
		try {
			const res = await fetch('/api/logout', { method: 'POST' });
			if (!res.ok) {
				toast.error('Sign out failed. Please try again.');
				return;
			}
			goToLogin();
			password = '';
			try {
				await goto('/');
			} catch {
				toast.error('Signed out, but could not open the home page.');
			}
		} catch {
			toast.error('Could not confirm sign out. Please try again.');
		} finally {
			loggingOut = false;
		}
	}

	onMount(() => {
		if (data.oidcError === 'forbidden') toast.error('Account not authorized.');
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
			onsubmit={handleLogin}
			class="mt-10 max-w-sm rounded-xl border border-[#EAEAEA] bg-white p-6 sm:p-8"
		>
			<label for="password" class="block text-sm font-medium text-[#111111]">Password</label>
			<input
				id="password"
				name="password"
				type="password"
				autocomplete="current-password"
				required
				bind:value={password}
				class="mt-2 w-full rounded-md border border-[#EAEAEA] bg-[#FBFBFA] px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#787774]"
			/>
			<button
				type="submit"
				disabled={loggingIn}
				class="mt-6 w-full rounded-md bg-[#111111] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[#333333] active:scale-98 disabled:opacity-50"
			>
				{loggingIn ? 'Signing in…' : 'Sign in'}
			</button>
			{#if data.oidcEnabled}
				<a
					href="/api/auth/oidc/start"
					class="mt-3 block w-full rounded-md border border-[#EAEAEA] bg-white px-6 py-3 text-center text-sm font-medium text-[#111111] transition-colors hover:bg-[#F5F5F4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#787774]"
				>
					Sign in with OIDC
				</a>
			{/if}
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
				disabled={loggingOut}
				class="inline-flex items-center gap-1.5 text-sm text-[#787774] transition-colors hover:text-[#111111]"
			>
				<SignOutIcon size={16} />
				{loggingOut ? 'Signing out…' : 'Sign out'}
			</button>
		</div>

		<div class="mt-10">
			<UploadCard
				onuploaded={loadFiles}
				onunauthorized={() => goToLogin('Session expired. Please sign in again.')}
			/>
		</div>

		<section class="mt-8 rounded-xl border border-[#EAEAEA] bg-white p-6 sm:p-8">
			<h2 class="text-lg font-semibold text-[#111111]">All files</h2>
			{#if loading}
				<p class="mt-4 text-sm text-[#787774]">Loading…</p>
			{:else if loadError}
				<p class="mt-4 text-sm leading-[1.6] text-[#9F2F2D]">{loadError}</p>
				<button
					type="button"
					onclick={loadFiles}
					class="mt-4 rounded-md border border-[#EAEAEA] px-4 py-2 text-sm font-medium text-[#111111] transition-colors hover:bg-[#F7F6F3]"
				>
					Try again
				</button>
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
