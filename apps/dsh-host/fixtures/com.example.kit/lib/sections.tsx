import { useMemo, useState } from "react";

import {
  Autocomplete,
  Badge,
  Button,
  Cascader,
  Checkbox,
  CodeBlock,
  CodeEditor,
  ColorPicker,
  CommitGraph,
  Copyable,
  CurrencyInput,
  DataGrid,
  EnvTable,
  DatePicker,
  DateRangePicker,
  DateTimePicker,
  DiffViewer,
  DonutChart,
  DurationInput,
  EnvBadge,
  EventCalendar,
  FileDropzone,
  FileTree,
  FilterBar,
  Gantt,
  Gauge,
  Input,
  JsonViewer,
  Kanban,
  Label,
  LogViewer,
  Markdown,
  MarkdownEditor,
  MiniCalendar,
  NumberField,
  PasswordField,
  PhoneInput,
  ProgressRing,
  Rating,
  RelativeDatePicker,
  RichTextEditor,
  SearchInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SeverityChip,
  Slider,
  SliderRange,
  SortableList,
  Sparkline,
  StatCard,
  StatusBadge,
  Stepper,
  StepperItem,
  Switch,
  TagInput,
  Textarea,
  TimePicker,
  TimeRangePicker,
  Timeline,
  TimezoneSelect,
  Transfer,
  TreeView,
  TrendCard,
  UserPicker,
  type CalendarEvent,
  type ColumnDef,
  type KanbanCard,
  type RelativePreset,
  type SortableItem,
} from "@monkey-mini-app/ui";

import {
  CAL_EVENTS,
  KANBAN_CARDS,
  KANBAN_COLUMNS,
  RUNS,
  SAMPLE_CODE,
  SAMPLE_MD,
  SORTABLES,
  TREE,
  type Run,
} from "./data";
import { Group } from "./group";

export function OverviewSection() {
  return (
    <>
      <Group title="状态与环境" hint="StatusBadge · EnvBadge · SeverityChip · Badge">
        <div className="space-y-3">
          <div>
            <div className="text-muted-foreground mb-2 text-[11px] font-medium tracking-wide uppercase">Status</div>
            <div className="flex flex-wrap items-center gap-2">
              {(["pass", "fail", "blocked", "flaky", "running", "pending"] as const).map((s) => (
                <StatusBadge key={s} status={s} />
              ))}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground mb-2 text-[11px] font-medium tracking-wide uppercase">Chips</div>
            <div className="flex flex-wrap items-center gap-2">
              <EnvBadge env="stg" />
              <SeverityChip severity="high" />
              <Badge>default</Badge>
              <Badge variant="secondary">secondary</Badge>
              <Badge variant="outline">outline</Badge>
            </div>
          </div>
        </div>
      </Group>
      <Group title="指标条" hint="StatCard · 等分四列">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard title="Runs" value="128" delta="+12% WoW" trend="up" />
          <StatCard title="Pass rate" value="94%" delta="last 7d" />
          <StatCard title="P1 open" value="3" delta="needs owner" trend="down" />
          <StatCard title="Latency p95" value="420ms" delta="-8%" trend="up" />
        </div>
      </Group>
      <Group title="环境变量" hint="EnvTable · 遮罩 / 显示 / 复制">
        <EnvTable
          title="Runtime"
          variables={[
            { key: "API_URL", value: "https://api.example.com", environment: "production", description: "Public API" },
            { key: "DATABASE_URL", value: "postgres://user:secret@db:5432/app", environment: "production" },
            { key: "DEBUG", value: "false", environment: "development" },
          ]}
        />
      </Group>
      <Group title="怎么用" hint="侧栏切分区 · 每区独立渲染">
        <p className="text-muted-foreground text-sm leading-6">
          左侧选分区，右侧只渲染当前区内容；区内再用卡片分组。用来对照 skill 契约挑组件，而不是一屏滚完整个 gallery。
        </p>
      </Group>
    </>
  );
}

export function FormsSection() {
  const [n, setN] = useState(3);
  const [text, setText] = useState("");
  const [area, setArea] = useState("notes");
  const [on, setOn] = useState(true);
  const [checked, setChecked] = useState(true);
  const [select, setSelect] = useState("stg");
  const [phone, setPhone] = useState("");
  const [pwd, setPwd] = useState("secret");
  const [search, setSearch] = useState("");
  const [money, setMoney] = useState("12.50");
  const [color, setColor] = useState("#2563eb");
  const [stars, setStars] = useState(3);
  const [tags, setTags] = useState(["qa", "ci"]);
  const [user, setUser] = useState("ada");
  const [auto, setAuto] = useState("");
  const [cascade, setCascade] = useState<string[]>([]);
  const [range, setRange] = useState([20, 80]);
  const [slider, setSlider] = useState([40]);
  const [transfer, setTransfer] = useState(["b"]);

  return (
    <div className="space-y-4">
      <Group title="基础输入" hint="Input / Textarea / NumberField / Search">
        <div className="grid max-w-xl gap-3 sm:grid-cols-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type here" />
          <NumberField value={n} onChange={setN} min={0} max={99} />
          <div className="sm:col-span-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Search…" />
          </div>
          <Textarea value={area} onChange={(e) => setArea(e.target.value)} className="sm:col-span-2" />
        </div>
      </Group>
      <Group title="选择类" hint="Checkbox / Switch / Select">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={checked} onCheckedChange={(v) => setChecked(!!v)} />
            Accept
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={on} onCheckedChange={(v) => setOn(v === true)} />
            Enabled
          </label>
          <Select value={select} onValueChange={(v) => v && setSelect(v)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dev">dev</SelectItem>
              <SelectItem value="stg">stg</SelectItem>
              <SelectItem value="prd">prd</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Group>
      <Group title="复合输入" hint="Phone / Password / Currency / Color / Rating / Tags / User">
        <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
          <PhoneInput value={phone} onChange={setPhone} />
          <PasswordField value={pwd} onChange={setPwd} />
          <CurrencyInput value={money} onChange={setMoney} />
          <ColorPicker value={color} onChange={setColor} />
          <Rating value={stars} onChange={setStars} />
          <TagInput value={tags} onChange={setTags} />
          <UserPicker
            value={user}
            onChange={setUser}
            users={[
              { id: "ada", name: "Ada" },
              { id: "lin", name: "Lin" },
              { id: "kai", name: "Kai" },
            ]}
          />
          <Copyable value="pnpm react-host" />
        </div>
      </Group>
      <Group title="高级选择" hint="Autocomplete / Cascader / Transfer / Slider">
        <div className="grid max-w-2xl gap-3">
          <Autocomplete
            value={auto}
            onChange={setAuto}
            options={["apple", "apricot", "banana", "berry"]}
            placeholder="Fruit…"
          />
          <Cascader
            value={cascade}
            onChange={setCascade}
            options={[
              {
                value: "cn",
                label: "China",
                children: [
                  { value: "sh", label: "Shanghai" },
                  { value: "bj", label: "Beijing" },
                ],
              },
              { value: "us", label: "USA", children: [{ value: "sf", label: "SF" }] },
            ]}
          />
          <Transfer
            value={transfer}
            onChange={setTransfer}
            items={[
              { id: "a", label: "Alpha" },
              { id: "b", label: "Bravo" },
              { id: "c", label: "Charlie" },
            ]}
          />
          <div className="space-y-2">
            <Label>Slider</Label>
            <Slider value={slider} onValueChange={setSlider} />
            <SliderRange value={range} onChange={setRange} />
          </div>
        </div>
      </Group>
    </div>
  );
}

export function DatesSection() {
  const [date, setDate] = useState<Date | undefined>(new Date("2026-08-26"));
  const [range, setRange] = useState<{ from?: Date; to?: Date } | undefined>();
  const [time, setTime] = useState("09:30");
  const [timeRange, setTimeRange] = useState({ start: "09:00", end: "18:00" });
  const [dt, setDt] = useState<Date | undefined>(new Date("2026-08-26T09:15:00"));
  const [zone, setZone] = useState("Asia/Shanghai");
  const [mini, setMini] = useState<Date | undefined>(new Date("2026-08-26"));
  const [preset, setPreset] = useState<RelativePreset>("7d");
  const [rel, setRel] = useState<{ from?: Date; to?: Date } | undefined>();
  const [duration, setDuration] = useState("2h 30m");

  return (
    <div className="space-y-4">
      <Group title="日期" hint="DatePicker / DateRange / MiniCalendar / Relative">
        <div className="flex flex-wrap gap-4">
          <DatePicker value={date} onChange={setDate} />
          <DateRangePicker value={range} onChange={setRange} />
          <MiniCalendar value={mini} onChange={setMini} />
          <RelativeDatePicker preset={preset} value={rel} onPresetChange={setPreset} onChange={setRel} />
        </div>
      </Group>
      <Group title="时间" hint="Time / TimeRange / DateTime / Timezone / Duration">
        <div className="flex flex-wrap gap-4">
          <TimePicker value={time} onChange={setTime} />
          <TimeRangePicker value={timeRange} onChange={setTimeRange} />
          <DateTimePicker value={dt} onChange={setDt} timezone={zone} onTimezoneChange={setZone} />
          <TimezoneSelect value={zone} onChange={setZone} />
          <DurationInput value={duration} onChange={setDuration} />
        </div>
      </Group>
    </div>
  );
}

export function DataSection() {
  const [items, setItems] = useState<SortableItem[]>(SORTABLES);
  const [files, setFiles] = useState<File[]>([]);
  const columns = useMemo<ColumnDef<Run>[]>(
    () => [
      { accessorKey: "name", header: "Name", meta: { sort: true, search: "text" } },
      { accessorKey: "owner", header: "Owner", meta: { sort: true, search: "text" } },
      { accessorKey: "duration", header: "Duration", meta: { sort: true, search: "text" } },
      {
        accessorKey: "status",
        header: "Status",
        meta: { sort: true, search: "select" },
        cell: ({ getValue }) => <StatusBadge status={String(getValue())} />,
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <Group title="DataGrid" hint="排序 / 列搜索 / 分页">
        <FilterBar>
          <Button size="sm" variant="outline">
            All
          </Button>
          <Button size="sm" variant="outline">
            Failures
          </Button>
        </FilterBar>
        <DataGrid columns={columns} data={RUNS} pageSize={5} />
      </Group>
      <Group title="结构数据" hint="JsonViewer / TreeView / SortableList / FileDropzone">
        <div className="grid gap-3 lg:grid-cols-2">
          <JsonViewer value={{ ok: true, runs: RUNS.length, nested: { a: 1 } }} />
          <TreeView nodes={TREE} />
          <SortableList items={items} onChange={setItems} />
          <FileDropzone files={files} onFiles={setFiles} />
        </div>
      </Group>
    </div>
  );
}

export function EditorsSection() {
  const [code, setCode] = useState(SAMPLE_CODE);
  const [md, setMd] = useState(SAMPLE_MD);
  const [rich, setRich] = useState("<p>Hello <strong>kit</strong></p>");

  return (
    <div className="space-y-4">
      <Group title="代码" hint="CodeEditor / DiffViewer / CodeBlock / LogViewer">
        <CodeEditor value={code} onChange={setCode} language="ts" height="180px" />
        <DiffViewer original={"a\nb\n"} modified={"a\nc\n"} fileName="sample.ts" />
        <CodeBlock language="ts" code={SAMPLE_CODE} />
        <LogViewer
          entries={[
            { level: "info", message: "boot" },
            { level: "warn", message: "slow" },
            { level: "error", message: "boom" },
            { level: "debug", message: "skip" },
          ]}
        />
      </Group>
      <Group title="文档" hint="Markdown / MarkdownEditor / RichTextEditor">
        <Markdown>{SAMPLE_MD}</Markdown>
        <MarkdownEditor value={md} onChange={setMd} />
        <RichTextEditor value={rich} onChange={setRich} />
      </Group>
    </div>
  );
}

export function BoardsSection() {
  const [cards, setCards] = useState<KanbanCard[]>(KANBAN_CARDS);
  const [events, setEvents] = useState<CalendarEvent[]>(CAL_EVENTS);
  const [step, setStep] = useState(1);

  return (
    <div className="space-y-4">
      <Group title="Kanban" hint="列拖拽卡片">
        <Kanban columns={KANBAN_COLUMNS} cards={cards} onCardsChange={setCards} />
      </Group>
      <Group title="EventCalendar" hint="day / week / month / year / agenda">
        <EventCalendar events={events} onEventsChange={setEvents} view="month" date={new Date("2026-08-26")} />
      </Group>
      <Group title="CommitGraph" hint="拓扑提交图 · forks / merges">
        <CommitGraph
          commits={[
            {
              hash: "a1b2c3d4e5f6",
              message: "feat: add EnvTable",
              author: { name: "Ada" },
              date: "2026-08-28T10:00:00Z",
              parents: ["f6e5d4c3b2a1"],
              refs: ["main"],
            },
            {
              hash: "f6e5d4c3b2a1",
              message: "feat: port Stepper",
              author: { name: "Lin" },
              date: "2026-08-27T16:00:00Z",
              parents: ["998877665544", "aabbccddeeff"],
              tag: "v0.2.0",
            },
            {
              hash: "aabbccddeeff",
              message: "fix: log viewer colors",
              author: { name: "Kai" },
              date: "2026-08-27T12:00:00Z",
              parents: ["998877665544"],
              refs: ["feat/logs"],
            },
            {
              hash: "998877665544",
              message: "chore: kit scaffold",
              author: { name: "Ada" },
              date: "2026-08-26T09:00:00Z",
              parents: [],
            },
          ]}
        />
      </Group>
      <Group title="Gantt / Timeline / Stepper">
        <Gantt
          tasks={[
            { id: "t1", title: "Kit scaffold", start: new Date("2026-08-01"), end: new Date("2026-08-10") },
            { id: "t2", title: "Calendar", start: new Date("2026-08-08"), end: new Date("2026-08-20") },
          ]}
        />
        <Timeline
          items={[
            { id: "1", title: "Registered", time: "09:00", description: "fixture seeded" },
            { id: "2", title: "Opened", time: "09:05", description: "panel iframe" },
          ]}
        />
        <Stepper>
          <StepperItem
            title="Pick"
            description="Choose section"
            status={step > 0 ? "completed" : "active"}
          />
          <StepperItem
            title="Try"
            description="Interact"
            status={step > 1 ? "completed" : step === 1 ? "active" : "default"}
          />
          <StepperItem
            title="Ship"
            description="Use in app"
            status={step >= 2 ? "active" : "default"}
          />
        </Stepper>
        <button type="button" className="text-sm underline" onClick={() => setStep((s) => (s + 1) % 3)}>
          Next step
        </button>
      </Group>
    </div>
  );
}

export function ChartsSection() {
  const spark = [3, 5, 4, 8, 6, 9, 7, 10];
  const slices = [
    { name: "pass", value: 72, fill: "var(--chart-1)" },
    { name: "fail", value: 12, fill: "var(--chart-2)" },
    { name: "other", value: 16, fill: "var(--chart-3)" },
  ];

  return (
    <div className="space-y-4">
      <Group title="指标卡" hint="StatCard / TrendCard / Sparkline / ProgressRing / Gauge">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard title="Throughput" value="1.2k" delta="/day" />
          <TrendCard
            title="Pass rate"
            value="94%"
            delta="+2%"
            trend="up"
            data={[
              { label: "Mon", value: 90 },
              { label: "Tue", value: 92 },
              { label: "Wed", value: 94 },
            ]}
          />
          <div className="flex items-center gap-4 rounded-xl border p-4">
            <ProgressRing value={72} />
            <Sparkline data={spark.map((value) => ({ value }))} className="w-32" />
            <Gauge value={68} label="Health" />
          </div>
        </div>
      </Group>
      <Group title="DonutChart" hint="分布">
        <DonutChart
          data={slices}
          config={{
            pass: { label: "Pass", color: "var(--chart-1)" },
            fail: { label: "Fail", color: "var(--chart-2)" },
            other: { label: "Other", color: "var(--chart-3)" },
          }}
        />
      </Group>
      <Group title="文件树" hint="FileTree 再看一眼">
        <FileTree nodes={TREE} />
      </Group>
    </div>
  );
}
