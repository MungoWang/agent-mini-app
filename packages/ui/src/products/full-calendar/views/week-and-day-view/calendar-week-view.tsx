import {addDays, format, isSameDay, parseISO, startOfWeek} from "date-fns";
import {motion} from "../../shims/motion";
import {ScrollArea} from "@monkey-mini-app/ui/components/scroll-area";
import {
    fadeIn,
    staggerContainer,
    transition,
} from "../../animations";
import {useCalendar} from "../../contexts/calendar-context";
import {AddEditEventDialog} from "../../dialogs/add-edit-event-dialog";
import {DroppableArea} from "../../dnd/droppable-area";
import {groupEvents, HOUR_HEIGHT_PX} from "../../helpers";
import {useTimeRangeCreate} from "../../hooks/use-time-range-create";
import type {IEvent} from "../../interfaces";
import {CalendarTimeline} from "./calendar-time-line";
import {RenderGroupedEvents} from "./render-grouped-events";
import {
    WeekViewMultiDayEventsRow
} from "./week-view-multi-day-events-row";
import {AlertCircleIcon} from 'lucide-react'

interface IProps {
    singleDayEvents: IEvent[];
    multiDayEvents: IEvent[];
}

export function CalendarWeekView({singleDayEvents, multiDayEvents}: IProps) {
    const {selectedDate, use24HourFormat} = useCalendar();
    const {
        selection,
        draft,
        clearDraft,
        overlayStyle,
        onPointerDown,
        onPointerMove,
        onPointerUp,
    } = useTimeRangeCreate();

    const weekStart = startOfWeek(selectedDate);
    const weekDays = Array.from({length: 7}, (_, i) => addDays(weekStart, i));
    const hours = Array.from({length: 24}, (_, i) => i);

    return (
        <motion.div
            data-testid="calendar-week-grid"
            initial="initial"
            animate="animate"
            exit="exit"
            variants={fadeIn}
            transition={transition}
        >
            <motion.div
                className="flex flex-col items-center justify-center border-b p-4 text-sm sm:hidden"
                initial={{opacity: 0, y: -20}}
                animate={{opacity: 1, y: 0}}
                transition={transition}
            >
                <p>Weekly view is not recommended on smaller devices.</p>
                <p>Please switch to a desktop device or use the daily view instead.</p>
            </motion.div>

            <motion.div
                className="flex-col sm:flex"
                variants={staggerContainer}
            >
                <div>
                    <WeekViewMultiDayEventsRow
                        selectedDate={selectedDate}
                        multiDayEvents={multiDayEvents}
                    />

                    {/* Week header */}
                    <motion.div
                        className="relative z-20 flex border-b"
                        initial={{opacity: 0, y: -20}}
                        animate={{opacity: 1, y: 0}}
                        transition={transition}
                    >
                        {/* Time column header - responsive width */}
                        <div className="w-18"></div>
                        <div className="grid flex-1 grid-cols-7  border-l">
                            {weekDays.map((day, index) => (
                                <motion.span
                                    key={day.toISOString()}
                                    className="py-1 sm:py-2 text-center text-xs font-medium text-t-quaternary"
                                    initial={{opacity: 0, y: -10}}
                                    animate={{opacity: 1, y: 0}}
                                    transition={{delay: index * 0.05, ...transition}}
                                >
                                    {/* Mobile: Show only day abbreviation and number */}
                                    <span className="block sm:hidden">
									{format(day, "EEE").charAt(0)}
                                        <span className="block font-semibold text-t-secondary text-xs">
										{format(day, "d")}
									</span>
								</span>
                                    {/* Desktop: Show full format */}
                                    <span className="hidden sm:inline">
									{format(day, "EE")}{" "}
                                        <span className="ml-1 font-semibold text-t-secondary">
										{format(day, "d")}
									</span>
								</span>
                                </motion.span>
                            ))}
                        </div>
                    </motion.div>

                </div>

                <ScrollArea className="h-[736px]">
                    <div className="flex">
                        {/* Hours column */}
                        <motion.div className="relative w-18" variants={staggerContainer}>
                            {hours.map((hour, index) => (
                                <motion.div
                                    key={hour}
                                    className="relative"
                                    style={{height: `${HOUR_HEIGHT_PX}px`}}
                                    initial={{opacity: 0, x: -20}}
                                    animate={{opacity: 1, x: 0}}
                                    transition={{delay: index * 0.02, ...transition}}
                                >
                                    <div className="absolute -top-3 right-2 flex h-6 items-center">
                                        {index !== 0 && (
                                            <span className="text-xs text-t-quaternary">
												{format(
                                                    new Date().setHours(hour, 0, 0, 0),
                                                    use24HourFormat ? "HH:00" : "h a",
                                                )}
											</span>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>

                        {/* Week grid */}
                        <motion.div
                            className="relative flex-1 border-l"
                            variants={staggerContainer}
                        >
                            <div className="grid grid-cols-7 divide-x">
                                {weekDays.map((day, dayIndex) => {
                                    const dayEvents = singleDayEvents.filter(
                                        (event) =>
                                            isSameDay(parseISO(event.startDate), day) ||
                                            isSameDay(parseISO(event.endDate), day),
                                    );
                                    const groupedEvents = groupEvents(dayEvents);

                                    const showOverlay =
                                        selection != null &&
                                        isSameDay(selection.day, day) &&
                                        overlayStyle != null;

                                    return (
                                        <motion.div
                                            key={day.toISOString()}
                                            className="relative touch-none select-none"
                                            data-testid="calendar-day-column"
                                            data-day={day.toISOString()}
                                            initial={{opacity: 0}}
                                            animate={{opacity: 1}}
                                            transition={{delay: dayIndex * 0.1, ...transition}}
                                            onPointerDown={(e) => onPointerDown(e, day, e.currentTarget)}
                                            onPointerMove={onPointerMove}
                                            onPointerUp={onPointerUp}
                                            onPointerCancel={onPointerUp}
                                        >
                                            {hours.map((hour, index) => (
                                                <motion.div
                                                    key={hour}
                                                    className="relative"
                                                    style={{height: `${HOUR_HEIGHT_PX}px`}}
                                                    initial={{opacity: 0}}
                                                    animate={{opacity: 1}}
                                                    transition={{delay: index * 0.01, ...transition}}
                                                >
                                                    {index !== 0 && (
                                                        <div
                                                            className="pointer-events-none absolute inset-x-0 top-0 border-b"></div>
                                                    )}

                                                    <DroppableArea
                                                        date={day}
                                                        hour={hour}
                                                        minute={0}
                                                        className="absolute inset-x-0 top-0 h-[48px]"
                                                    >
                                                        <div className="absolute inset-0" />
                                                    </DroppableArea>

                                                    <div
                                                        className="pointer-events-none absolute inset-x-0 top-1/2 border-b border-dashed border-b-tertiary"></div>

                                                    <DroppableArea
                                                        date={day}
                                                        hour={hour}
                                                        minute={30}
                                                        className="absolute inset-x-0 bottom-0 h-[48px]"
                                                    >
                                                        <div className="absolute inset-0" />
                                                    </DroppableArea>
                                                </motion.div>
                                            ))}

                                            {showOverlay ? (
                                                <div
                                                    className="pointer-events-none absolute inset-x-0.5 z-10 rounded-md border border-primary/40 bg-primary/15"
                                                    data-testid="calendar-selection-overlay"
                                                    style={overlayStyle}
                                                />
                                            ) : null}

                                            <div className="pointer-events-auto relative z-20">
                                                <RenderGroupedEvents
                                                    groupedEvents={groupedEvents}
                                                    day={day}
                                                />
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>

                            <CalendarTimeline/>
                        </motion.div>

                        {draft ? (
                            <AddEditEventDialog
                                open
                                onOpenChange={(open) => {
                                    if (!open) clearDraft();
                                }}
                                startDate={draft.start}
                                startTime={{
                                    hour: draft.start.getHours(),
                                    minute: draft.start.getMinutes(),
                                }}
                                endTime={{
                                    hour: draft.end.getHours(),
                                    minute: draft.end.getMinutes(),
                                }}
                            />
                        ) : null}
                    </div>
                </ScrollArea>
            </motion.div>
        </motion.div>
    );
}


