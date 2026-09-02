import { motion } from "../../shims/motion";
import { useMemo } from "react";
import {
	staggerContainer,
	transition,
} from "../../animations";
import { useLabels } from "@monkey-mini-app/ui/i18n/context";
import { useCalendar } from "../../contexts/calendar-context";

import {
	calculateMonthEventPositions,
	getCalendarCells,
} from "../../helpers";

import type { IEvent } from "../../interfaces";
import { DayCell } from "./day-cell";

interface IProps {
	singleDayEvents: IEvent[];
	multiDayEvents: IEvent[];
}

export function CalendarMonthView({ singleDayEvents, multiDayEvents }: IProps) {
	const { selectedDate } = useCalendar();
	const t = useLabels("eventCalendar");

	const allEvents = [...multiDayEvents, ...singleDayEvents];

	const cells = useMemo(() => getCalendarCells(selectedDate), [selectedDate]);

	const eventPositions = useMemo(
		() =>
			calculateMonthEventPositions(
				multiDayEvents,
				singleDayEvents,
				selectedDate,
			),
		[multiDayEvents, singleDayEvents, selectedDate],
	);

	return (
		<motion.div initial="initial" animate="animate" variants={staggerContainer}>
			<div className="grid grid-cols-7">
				{t.weekdaysSun.map((day, index) => (
					<motion.div
						key={day}
						className="flex items-center justify-center py-2"
						initial={{ opacity: 0, y: -10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: index * 0.05, ...transition }}
					>
						<span className="text-xs font-medium text-t-quaternary">{day}</span>
					</motion.div>
				))}
			</div>

			<div className="grid grid-cols-7 overflow-hidden">
				{cells.map((cell) => (
					<DayCell
						key={cell.date.toISOString()}
						cell={cell}
						events={allEvents}
						eventPositions={eventPositions}
					/>
				))}
			</div>
		</motion.div>
	);
}
