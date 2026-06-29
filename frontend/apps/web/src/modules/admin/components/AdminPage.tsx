"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, KeyRound, Menu, Plus, ShieldCheck } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui/sheet"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog"
import { Switch } from "@/shared/ui/switch"
import { Button } from "@/shared/ui/button"
import { Badge } from "@/shared/ui/badge"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import {
  AppNavMenu,
  appNavSheetClassName,
  appNavSheetHeaderClassName,
  appNavSheetOverlayClassName,
  appNavSheetTitleClassName,
} from "@/shared/layout/AppNavMenu"
import { clearAuthToken, canAction } from "@/shared/lib/auth"
import { useApiQuery } from "@/shared/hooks/useApiQuery"
import { useMounted } from "@/shared/hooks/useMounted"
import { toast } from "@/shared/hooks/use-toast"
import { ApiError } from "@/shared/api-client"
import {
  APP_ROLE_LABELS,
  APP_ROLE_OPTIONS,
  type AppRole,
} from "@/shared/lib/permissions.constants"
import {
  adminApi,
  type AdminRole,
  type AdminUser,
  type ResetPinResult,
  type CreateUserPayload,
} from "../services/admin.api"

const ROLE_CAPABILITY_LABELS: Record<string, string> = {
  operator: "พนักงาน (เห็นเฉพาะงานตัวเอง)",
  weighing_staff: "ตวงสูตรทุกงาน / ผลิตเฉพาะที่มอบหมาย",
  supervisor: "หัวหน้า (เห็นงานทั้งหมด)",
  elevated: "ผู้ดูแลระบบ",
}

export function AdminPage() {
  const router = useRouter()
  const mounted = useMounted()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [canManage, setCanManage] = useState(false)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [savingId, setSavingId] = useState<number | null>(null)
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null)
  const [resetResult, setResetResult] = useState<ResetPinResult | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [createForm, setCreateForm] = useState<CreateUserPayload>({
    name: "",
    idCode: "",
    tempPin: "",
    appRole: "operator",
  })
  const [createdTempPin, setCreatedTempPin] = useState<string | null>(null)

  useEffect(() => {
    if (mounted) {
      setCanManage(canAction("admin.users.write"))
    }
  }, [mounted])

  const configQuery = useApiQuery(() => adminApi.getConfig(), [mounted], {
    enabled: mounted,
  })
  const usersQuery = useApiQuery<AdminUser[]>(() => adminApi.listUsers(), [mounted], {
    enabled: mounted,
  })
  const rolesQuery = useApiQuery<AdminRole[]>(() => adminApi.listRoles(), [mounted], {
    enabled: mounted,
  })

  const ownAuth = configQuery.data?.ownAuth ?? false

  useEffect(() => {
    if (usersQuery.data) {
      setUsers(usersQuery.data)
    }
  }, [usersQuery.data])

  const roles = useMemo(() => rolesQuery.data ?? [], [rolesQuery.data])

  const roleOptions = useMemo(() => {
    if (ownAuth) {
      return APP_ROLE_OPTIONS.map((appRole) => ({
        value: appRole,
        label: APP_ROLE_LABELS[appRole],
        appRole,
        canReadAllJobs: roles.find((r) => r.appRole === appRole)?.canReadAllJobs ?? false,
        canReadAllWeighingJobs:
          roles.find((r) => r.appRole === appRole)?.canReadAllWeighingJobs ?? false,
        canAdmin: roles.find((r) => r.appRole === appRole)?.canAdmin ?? false,
      }))
    }

    return roles.map((role) => ({
      value: String(role.id),
      label: role.display_name,
      appRole: role.appRole as AppRole,
      canReadAllJobs: role.canReadAllJobs,
      canReadAllWeighingJobs: role.canReadAllWeighingJobs,
      canAdmin: role.canAdmin,
    }))
  }, [ownAuth, roles])

  const defaultAppRole: AppRole = "operator"

  const handleLogout = () => {
    setIsMenuOpen(false)
    clearAuthToken()
    router.push("/login")
  }

  const applyUserUpdate = (updated: AdminUser) => {
    setUsers((prev) =>
      prev.map((user) => (user.id === updated.id ? updated : user)),
    )
  }

  const handleRoleChange = async (user: AdminUser, value: string) => {
    if (ownAuth) {
      const appRole = value as AppRole
      if (appRole === user.appRole) return
      setSavingId(user.id)
      try {
        const updated = await adminApi.updateUser(user.id, { appRole })
        applyUserUpdate(updated)
        toast({
          title: "อัปเดตบทบาทแล้ว",
          description: `${updated.name} → ${updated.roleDisplayName ?? APP_ROLE_LABELS[appRole]}`,
        })
      } catch (error) {
        toast({
          title: "อัปเดตบทบาทไม่สำเร็จ",
          description: error instanceof ApiError ? error.message : "เกิดข้อผิดพลาด",
          variant: "destructive",
        })
      } finally {
        setSavingId(null)
      }
      return
    }

    const roleId = Number(value)
    if (Number.isNaN(roleId) || roleId === user.roleId) return
    setSavingId(user.id)
    try {
      const updated = await adminApi.updateUser(user.id, { roleId })
      applyUserUpdate(updated)
      toast({
        title: "อัปเดตบทบาทแล้ว",
        description: `${updated.name} → ${updated.roleDisplayName ?? updated.roleName ?? "-"}`,
      })
    } catch (error) {
      toast({
        title: "อัปเดตบทบาทไม่สำเร็จ",
        description: error instanceof ApiError ? error.message : "เกิดข้อผิดพลาด",
        variant: "destructive",
      })
    } finally {
      setSavingId(null)
    }
  }

  const handleActiveToggle = async (user: AdminUser, isActive: boolean) => {
    setSavingId(user.id)
    try {
      const updated = await adminApi.updateUser(user.id, { isActive })
      applyUserUpdate(updated)
      toast({
        title: isActive ? "เปิดใช้งานบัญชีแล้ว" : "ปิดใช้งานบัญชีแล้ว",
        description: updated.name,
      })
    } catch (error) {
      toast({
        title: "อัปเดตสถานะไม่สำเร็จ",
        description: error instanceof ApiError ? error.message : "เกิดข้อผิดพลาด",
        variant: "destructive",
      })
    } finally {
      setSavingId(null)
    }
  }

  const handleCreateUser = async () => {
    const hasRole = ownAuth ? Boolean(createForm.appRole) : Boolean(createForm.roleId)
    if (
      !createForm.name.trim() ||
      !createForm.idCode.trim() ||
      !createForm.tempPin.trim() ||
      !hasRole
    ) {
      return
    }
    setIsCreating(true)
    try {
      const payload: CreateUserPayload = ownAuth
        ? {
            name: createForm.name,
            idCode: createForm.idCode,
            tempPin: createForm.tempPin,
            appRole: createForm.appRole ?? defaultAppRole,
          }
        : {
            name: createForm.name,
            idCode: createForm.idCode,
            tempPin: createForm.tempPin,
            roleId: createForm.roleId,
          }
      const newUser = await adminApi.createUser(payload)
      setUsers((prev) => [...prev, newUser])
      setCreatedTempPin(createForm.tempPin)
      setIsCreateOpen(false)
      setCreateForm({
        name: "",
        idCode: "",
        tempPin: "",
        appRole: defaultAppRole,
      })
      toast({ title: "เพิ่มผู้ใช้แล้ว", description: newUser.name })
    } catch (error) {
      toast({
        title: "เพิ่มผู้ใช้ไม่สำเร็จ",
        description: error instanceof ApiError ? error.message : "เกิดข้อผิดพลาด",
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleResetPin = async () => {
    if (!resetTarget) return
    const target = resetTarget
    setResetTarget(null)
    setSavingId(target.id)
    try {
      const result = await adminApi.resetPin(target.id)
      setResetResult(result)
    } catch (error) {
      toast({
        title: "รีเซ็ต PIN ไม่สำเร็จ",
        description: error instanceof ApiError ? error.message : "เกิดข้อผิดพลาด",
        variant: "destructive",
      })
    } finally {
      setSavingId(null)
    }
  }

  const getUserRoleSelectValue = (user: AdminUser): string | undefined => {
    if (ownAuth) {
      return user.appRole ?? undefined
    }
    return user.roleId != null ? String(user.roleId) : undefined
  }

  const menuButton = (
    <button
      type="button"
      aria-label="เมนู"
      className="p-2 rounded-xl hover:bg-muted/50 transition-colors"
    >
      <Menu className="w-6 h-6" />
    </button>
  )

  return (
    <div className="min-h-screen bg-transparent">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-border/40 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {mounted ? (
              <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                <SheetTrigger asChild>{menuButton}</SheetTrigger>
                <SheetContent
                  side="left"
                  className={appNavSheetClassName}
                  overlayClassName={appNavSheetOverlayClassName}
                >
                  <SheetHeader className={appNavSheetHeaderClassName}>
                    <SheetTitle className={appNavSheetTitleClassName}>เมนู</SheetTitle>
                  </SheetHeader>
                  <AppNavMenu
                    activeMenu="admin_console"
                    onNavigate={() => setIsMenuOpen(false)}
                    onLogout={handleLogout}
                  />
                </SheetContent>
              </Sheet>
            ) : (
              menuButton
            )}
            <Link
              href="/"
              className="p-2 rounded-xl hover:bg-muted/50 transition-colors"
              aria-label="กลับ"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </div>

          <h1 className="text-lg font-bold">จัดการผู้ใช้และสิทธิ์</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {ownAuth ? (
          <Card className="rounded-2xl border-sky-300/50 bg-sky-50/50">
            <CardContent className="py-4 text-sm text-sky-900">
              โหมดสิทธิ์ TimeTracker แยกจาก role ร่วมใน DB — การเปลี่ยนบทบาทที่นี่จะไม่กระทบระบบอื่น
            </CardContent>
          </Card>
        ) : null}

        {!canManage ? (
          <Card className="rounded-2xl border-amber-300/50 bg-amber-50/50">
            <CardContent className="py-4 text-sm text-amber-800">
              บัญชีนี้ดูข้อมูลได้อย่างเดียว ไม่มีสิทธิ์แก้ไข (ต้องมีสิทธิ์ admin.users.write)
            </CardContent>
          </Card>
        ) : null}

        <Card className="rounded-2xl border-border/40">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">ผู้ใช้งาน</CardTitle>
              {canManage ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setCreateForm({
                      name: "",
                      idCode: "",
                      tempPin: "",
                      appRole: defaultAppRole,
                    })
                    setIsCreateOpen(true)
                  }}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  เพิ่มผู้ใช้
                </Button>
              ) : null}
            </div>
            <CardDescription>
              กำหนดบทบาท (สิทธิ์การเข้าถึง), เปิด/ปิดการใช้งาน และรีเซ็ต PIN ของแต่ละคน
            </CardDescription>
          </CardHeader>
          <CardContent>
            {usersQuery.isLoading && users.length === 0 ? (
              <p className="text-sm text-muted-foreground">กำลังโหลดข้อมูล...</p>
            ) : usersQuery.error ? (
              <p className="text-sm text-destructive">โหลดรายชื่อผู้ใช้ไม่สำเร็จ</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ชื่อ</TableHead>
                      <TableHead>รหัส</TableHead>
                      <TableHead>แผนก</TableHead>
                      <TableHead className="w-[220px]">บทบาท</TableHead>
                      <TableHead className="text-center">ใช้งาน</TableHead>
                      <TableHead className="text-right">PIN</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => {
                      const selectedRole = ownAuth
                        ? roleOptions.find((r) => r.value === user.appRole)
                        : roleOptions.find((r) => r.value === String(user.roleId))
                      return (
                        <TableRow key={user.id} data-busy={savingId === user.id}>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell className="text-muted-foreground">{user.idCode}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {user.department?.trim() || "—"}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Select
                                value={getUserRoleSelectValue(user)}
                                onValueChange={(value) => handleRoleChange(user, value)}
                                disabled={!canManage || savingId === user.id || roleOptions.length === 0}
                              >
                                <SelectTrigger className="w-full" size="sm">
                                  <SelectValue placeholder="เลือกบทบาท" />
                                </SelectTrigger>
                                <SelectContent>
                                  {roleOptions.map((roleOption) => (
                                    <SelectItem key={roleOption.value} value={roleOption.value}>
                                      {roleOption.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {selectedRole ? (
                                <p className="text-xs text-muted-foreground">
                                  {ROLE_CAPABILITY_LABELS[selectedRole.appRole] ??
                                    selectedRole.appRole}
                                </p>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={user.isActive}
                              onCheckedChange={(checked) => handleActiveToggle(user, checked)}
                              disabled={!canManage || savingId === user.id}
                              aria-label="เปิด/ปิดการใช้งาน"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={!canManage || savingId === user.id}
                              onClick={() => setResetTarget(user)}
                            >
                              <KeyRound className="mr-1 h-3.5 w-3.5" />
                              รีเซ็ต PIN
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/40">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> บทบาทและสิทธิ์
            </CardTitle>
            <CardDescription>
              ความหมายของแต่ละบทบาทเมื่อนำไปกำหนดให้ผู้ใช้
            </CardDescription>
          </CardHeader>
          <CardContent>
            {roleOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {roleOptions.map((role) => (
                  <li
                    key={role.value}
                    className="rounded-xl border border-border/40 bg-muted/20 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{role.label}</span>
                      <Badge variant="secondary">
                        {ROLE_CAPABILITY_LABELS[role.appRole] ?? role.appRole}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {role.canReadAllJobs ? (
                        <Badge variant="outline" className="text-xs">เห็นงานผลิตทั้งหมด</Badge>
                      ) : role.canReadAllWeighingJobs ? (
                        <Badge variant="outline" className="text-xs">เห็นงานตวงทั้งหมด</Badge>
                      ) : null}
                      {!role.canReadAllJobs ? (
                        <Badge variant="outline" className="text-xs">ผลิตเฉพาะงานที่มอบหมาย</Badge>
                      ) : null}
                      {role.canAdmin ? (
                        <Badge variant="outline" className="text-xs">จัดการระบบได้</Badge>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>

      <AlertDialog
        open={resetTarget != null}
        onOpenChange={(open) => {
          if (!open) setResetTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>รีเซ็ต PIN?</AlertDialogTitle>
            <AlertDialogDescription>
              ระบบจะตั้ง PIN ชั่วคราวให้ {resetTarget?.name} และแสดงให้ครั้งเดียว
              ผู้ใช้ควรนำไปเข้าสู่ระบบแล้วเปลี่ยน PIN ใหม่เองในหน้าโปรไฟล์
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetPin}>รีเซ็ต PIN</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={resetResult != null}
        onOpenChange={(open) => {
          if (!open) setResetResult(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>PIN ชั่วคราว</DialogTitle>
            <DialogDescription>
              แจ้ง PIN นี้ให้ {resetResult?.name} เพื่อเข้าสู่ระบบ จากนั้นให้เปลี่ยน PIN
              ใหม่เองในหน้าโปรไฟล์ (PIN นี้จะแสดงเพียงครั้งเดียว)
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-border/40 bg-muted/30 py-6 text-center">
            <span className="text-3xl font-bold tracking-[0.4em]">
              {resetResult?.tempPin}
            </span>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setResetResult(null)}>
              เสร็จสิ้น
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateOpen} onOpenChange={(open) => { if (!open) setIsCreateOpen(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เพิ่มผู้ใช้ใหม่</DialogTitle>
            <DialogDescription>
              กรอกข้อมูลผู้ใช้และกำหนด PIN ชั่วคราวสำหรับลงทะเบียนครั้งแรก
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="create-name">ชื่อ-นามสกุล</Label>
              <Input
                id="create-name"
                placeholder="เช่น สมชาย ใจดี"
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-idcode">รหัสพนักงาน</Label>
              <Input
                id="create-idcode"
                placeholder="เช่น EMP001"
                value={createForm.idCode}
                onChange={(e) => setCreateForm((f) => ({ ...f, idCode: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-role">บทบาท</Label>
              <Select
                value={
                  ownAuth
                    ? (createForm.appRole ?? defaultAppRole)
                    : createForm.roleId
                      ? String(createForm.roleId)
                      : undefined
                }
                onValueChange={(value) =>
                  setCreateForm((f) =>
                    ownAuth
                      ? { ...f, appRole: value as AppRole }
                      : { ...f, roleId: Number(value) },
                  )
                }
                disabled={roleOptions.length === 0}
              >
                <SelectTrigger id="create-role" className="w-full">
                  <SelectValue placeholder="เลือกบทบาท" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((roleOption) => (
                    <SelectItem key={roleOption.value} value={roleOption.value}>
                      {roleOption.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-pin">PIN ชั่วคราว (4 หลัก)</Label>
              <Input
                id="create-pin"
                placeholder="กำหนด PIN ชั่วคราว"
                maxLength={4}
                value={createForm.tempPin}
                onChange={(e) => setCreateForm((f) => ({ ...f, tempPin: e.target.value.replace(/\D/g, "") }))}
              />
              <p className="text-xs text-muted-foreground">พนักงานจะใช้ PIN นี้เพื่อลงทะเบียนตั้ง PIN ของตัวเองที่หน้า /register</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>ยกเลิก</Button>
            <Button
              type="button"
              disabled={
                isCreating ||
                !createForm.name.trim() ||
                !createForm.idCode.trim() ||
                createForm.tempPin.length < 4 ||
                (ownAuth ? !createForm.appRole : !createForm.roleId)
              }
              onClick={handleCreateUser}
            >
              {isCreating ? "กำลังเพิ่ม..." : "เพิ่มผู้ใช้"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createdTempPin != null} onOpenChange={(open) => { if (!open) setCreatedTempPin(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>PIN ชั่วคราวสำหรับลงทะเบียน</DialogTitle>
            <DialogDescription>
              แจ้ง PIN นี้ให้พนักงานเพื่อใช้ลงทะเบียนที่หน้า /register (แสดงเพียงครั้งเดียว)
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-border/40 bg-muted/30 py-6 text-center">
            <span className="text-3xl font-bold tracking-[0.4em]">
              {createdTempPin}
            </span>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setCreatedTempPin(null)}>
              เสร็จสิ้น
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
