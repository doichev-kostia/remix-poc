import React, { useState } from "react";
import { Form, Link, useFetcher } from "@remix-run/react";
import { useAppState } from "~/app/app-state.js";
import { Popover, PopoverContent, PopoverTrigger } from "~/app/ui/popover.js";
import { Button } from "~/app/ui/button.js";
import { CaretSortIcon } from "@radix-ui/react-icons";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList, CommandSeparator } from "~/app/ui/command.js";
import { Check } from "lucide-react";
import { cn } from "~/app/lib/utils.js";

type CTA = {
	name: string;
	action: string;
	method: "get" | "post"
};

const callsToAction: Array<CTA> = [
	{
		name: "sign out",
		action: "/sign-out",
		method: "post",
	}
];

export function Header() {
	const state = useAppState();

	const [open, setOpen] = useState(false);

	const accounts = Object.values(state.accounts)
		.map((account) => {
			return {
				id: account.id,
				title: account.displayName,
			};
		});

	const current = accounts.find(acc => acc.id === state.currentAccountID)!;

	return (
		<header className="bg-white">
			<div className="flex justify-between p-4">
				<Link to="/" className="text-sm font-semibold leading-6 text-gray-900">
					‹ Back
				</Link>
				<div>
					<Popover open={open} onOpenChange={setOpen}>
						<PopoverTrigger asChild>
							<Button
								variant="outline"
								role="combobox"
								aria-expanded={open}
								className="w-[200px] justify-between"
							>
								{current.title}
								<CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50"/>
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-[200px] p-0">
							<Command>
								<CommandList>
									<CommandEmpty>No results found.</CommandEmpty>
									<CommandGroup>
										{accounts.map(account => (
											<CommandItem
												key={account.id}
											>
												{account.title}
												<Check
													className={cn(
														"mr-2 h-4 w-4",
														state.currentAccountID === account.id ? "opacity-100" : "opacity-0"
													)}
												/>
											</CommandItem>
										))}
									</CommandGroup>
								</CommandList>
								<CommandSeparator/>
								<CommandList>
									<CommandGroup className="flex flex-col gap-2">
										{callsToAction.map(({action, name, method}) => (
											<Form method={method} action={action} className="w-full" key={action + method}>
												<CommandItem asChild className="text-muted-foreground text-start">
													<button
														type="submit"
														className="w-full"
													>
														{name}
													</button>
												</CommandItem>
											</Form>
										))}
									</CommandGroup>
								</CommandList>
							</Command>
						</PopoverContent>
					</Popover>
				</div>
			</div>
		</header>
	);
}
