<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	const copy = $derived.by(() => {
		if (page.status === 404)
			return {
				title: 'Page not found',
				body: 'The link may be broken, or the page may have been removed.'
			};
		if (page.status === 403)
			return { title: 'Access denied', body: 'You do not have access to this page.' };
		if (page.status === 429)
			return { title: 'Too many requests', body: 'Wait a moment, then try again.' };
		if (page.status >= 500)
			return {
				title: 'Something went wrong',
				body: 'The error was not your fault. Try again in a moment.'
			};
		return {
			title: 'Request failed',
			body: page.error?.message ?? 'Please try again.'
		};
	});
</script>

<svelte:head>
	<title>{page.status} — sheaf</title>
</svelte:head>

<main class="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-24">
	<p class="text-2xl text-[#111111]" style="font-family: Georgia, serif;">sheaf</p>
	<p class="mt-10 text-sm tracking-[0.2em] text-[#787774] tabular-nums">{page.status}</p>
	<h1
		class="mt-4 text-4xl leading-[1.1] tracking-[-0.03em] text-[#111111] sm:text-5xl"
		style="font-family: Georgia, serif;"
	>
		{copy.title}
	</h1>
	<p class="mt-6 max-w-xl text-base leading-[1.6] text-[#2F3437]">{copy.body}</p>
	<a
		href={resolve('/')}
		class="mt-10 w-fit rounded-md border border-[#EAEAEA] bg-white px-6 py-3 text-sm font-medium text-[#111111] hover:bg-[#F7F6F3]"
	>
		Back to home
	</a>
</main>
