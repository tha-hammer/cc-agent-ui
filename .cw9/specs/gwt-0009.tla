---- MODULE gwt_0009_no_regression_normal ----

EXTENDS Integers, FiniteSets, TLC

PlanTools == {"Read", "Task", "exit_plan_mode", "TodoRead", "TodoWrite", "WebFetch", "WebSearch"}

(* --algorithm MapCliOptionsToSDK

variables
    hasCwd           \in {TRUE, FALSE},
    permissionModeIn \in {"default", "plan", "bypassPermissions", "acceptEdits"},
    skipPermissions  \in {TRUE, FALSE},
    allowedToolsIn   \in { {"Bash"}, {} },
    phase            = "Init",
    outAllowedTools  = {},
    outHasCwd        = FALSE,
    outHasPerm       = FALSE,
    outPermMode      = "none",
    outForkLeaked    = FALSE;

define

    NoForkFieldsWhenAbsent ==
        phase = "Complete" => ~outForkLeaked

    NormalShapePreserved ==
        phase = "Complete" =>
            (outHasPerm =>
                outPermMode \in {"plan", "bypassPermissions", "acceptEdits"})

    PlanModeToolsUnion ==
        (phase = "Complete" /\ permissionModeIn = "plan") =>
            PlanTools \subseteq outAllowedTools

    BypassPermissionsSetCorrectly ==
        (phase = "Complete" /\ skipPermissions /\ permissionModeIn # "plan") =>
            (outHasPerm /\ outPermMode = "bypassPermissions")

    DefaultPermissionModeNotWritten ==
        (phase = "Complete" /\ permissionModeIn = "default" /\ ~skipPermissions) =>
            ~outHasPerm

    AllInvariants ==
        NoForkFieldsWhenAbsent
        /\ NormalShapePreserved
        /\ PlanModeToolsUnion
        /\ BypassPermissionsSetCorrectly
        /\ DefaultPermissionModeNotWritten

end define;

fair process Actor = "main"
begin
    SetCwd:
        if hasCwd then
            outHasCwd := TRUE;
        end if;
    SetAllowedTools:
        if permissionModeIn = "plan" then
            outAllowedTools := allowedToolsIn \union PlanTools;
        else
            outAllowedTools := allowedToolsIn;
        end if;
    SetPermissionMode:
        if skipPermissions /\ permissionModeIn # "plan" then
            outHasPerm  := TRUE;
            outPermMode := "bypassPermissions";
        elsif permissionModeIn \in {"plan", "bypassPermissions", "acceptEdits"} then
            outHasPerm  := TRUE;
            outPermMode := permissionModeIn;
        end if;
    Complete:
        phase := "Complete";
end process;

end algorithm; *)
\* BEGIN TRANSLATION (chksum(pcal) = "a015db35" /\ chksum(tla) = "a24664c2")
VARIABLES pc, hasCwd, permissionModeIn, skipPermissions, allowedToolsIn, 
          phase, outAllowedTools, outHasCwd, outHasPerm, outPermMode, 
          outForkLeaked

(* define statement *)
NoForkFieldsWhenAbsent ==
    phase = "Complete" => ~outForkLeaked

NormalShapePreserved ==
    phase = "Complete" =>
        (outHasPerm =>
            outPermMode \in {"plan", "bypassPermissions", "acceptEdits"})

PlanModeToolsUnion ==
    (phase = "Complete" /\ permissionModeIn = "plan") =>
        PlanTools \subseteq outAllowedTools

BypassPermissionsSetCorrectly ==
    (phase = "Complete" /\ skipPermissions /\ permissionModeIn # "plan") =>
        (outHasPerm /\ outPermMode = "bypassPermissions")

DefaultPermissionModeNotWritten ==
    (phase = "Complete" /\ permissionModeIn = "default" /\ ~skipPermissions) =>
        ~outHasPerm

AllInvariants ==
    NoForkFieldsWhenAbsent
    /\ NormalShapePreserved
    /\ PlanModeToolsUnion
    /\ BypassPermissionsSetCorrectly
    /\ DefaultPermissionModeNotWritten


vars == << pc, hasCwd, permissionModeIn, skipPermissions, allowedToolsIn, 
           phase, outAllowedTools, outHasCwd, outHasPerm, outPermMode, 
           outForkLeaked >>

ProcSet == {"main"}

Init == (* Global variables *)
        /\ hasCwd \in {TRUE, FALSE}
        /\ permissionModeIn \in {"default", "plan", "bypassPermissions", "acceptEdits"}
        /\ skipPermissions \in {TRUE, FALSE}
        /\ allowedToolsIn \in { {"Bash"}, {} }
        /\ phase = "Init"
        /\ outAllowedTools = {}
        /\ outHasCwd = FALSE
        /\ outHasPerm = FALSE
        /\ outPermMode = "none"
        /\ outForkLeaked = FALSE
        /\ pc = [self \in ProcSet |-> "SetCwd"]

SetCwd == /\ pc["main"] = "SetCwd"
          /\ IF hasCwd
                THEN /\ outHasCwd' = TRUE
                ELSE /\ TRUE
                     /\ UNCHANGED outHasCwd
          /\ pc' = [pc EXCEPT !["main"] = "SetAllowedTools"]
          /\ UNCHANGED << hasCwd, permissionModeIn, skipPermissions, 
                          allowedToolsIn, phase, outAllowedTools, outHasPerm, 
                          outPermMode, outForkLeaked >>

SetAllowedTools == /\ pc["main"] = "SetAllowedTools"
                   /\ IF permissionModeIn = "plan"
                         THEN /\ outAllowedTools' = (allowedToolsIn \union PlanTools)
                         ELSE /\ outAllowedTools' = allowedToolsIn
                   /\ pc' = [pc EXCEPT !["main"] = "SetPermissionMode"]
                   /\ UNCHANGED << hasCwd, permissionModeIn, skipPermissions, 
                                   allowedToolsIn, phase, outHasCwd, 
                                   outHasPerm, outPermMode, outForkLeaked >>

SetPermissionMode == /\ pc["main"] = "SetPermissionMode"
                     /\ IF skipPermissions /\ permissionModeIn # "plan"
                           THEN /\ outHasPerm' = TRUE
                                /\ outPermMode' = "bypassPermissions"
                           ELSE /\ IF permissionModeIn \in {"plan", "bypassPermissions", "acceptEdits"}
                                      THEN /\ outHasPerm' = TRUE
                                           /\ outPermMode' = permissionModeIn
                                      ELSE /\ TRUE
                                           /\ UNCHANGED << outHasPerm, 
                                                           outPermMode >>
                     /\ pc' = [pc EXCEPT !["main"] = "Complete"]
                     /\ UNCHANGED << hasCwd, permissionModeIn, skipPermissions, 
                                     allowedToolsIn, phase, outAllowedTools, 
                                     outHasCwd, outForkLeaked >>

Complete == /\ pc["main"] = "Complete"
            /\ phase' = "Complete"
            /\ pc' = [pc EXCEPT !["main"] = "Done"]
            /\ UNCHANGED << hasCwd, permissionModeIn, skipPermissions, 
                            allowedToolsIn, outAllowedTools, outHasCwd, 
                            outHasPerm, outPermMode, outForkLeaked >>

Actor == SetCwd \/ SetAllowedTools \/ SetPermissionMode \/ Complete

(* Allow infinite stuttering to prevent deadlock on termination. *)
Terminating == /\ \A self \in ProcSet: pc[self] = "Done"
               /\ UNCHANGED vars

Next == Actor
           \/ Terminating

Spec == /\ Init /\ [][Next]_vars
        /\ WF_vars(Actor)

Termination == <>(\A self \in ProcSet: pc[self] = "Done")

\* END TRANSLATION 

\* gwt_0009_no_regression_normal.cfg
\*
\* INVARIANT NoForkFieldsWhenAbsent
\* INVARIANT NormalShapePreserved
\* INVARIANT PlanModeToolsUnion
\* INVARIANT BypassPermissionsSetCorrectly
\* INVARIANT DefaultPermissionModeNotWritten

====
