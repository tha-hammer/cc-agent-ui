---- MODULE gwt0014ErrorPathOnBadUUID ----

EXTENDS Integers, Sequences, TLC

CONSTANTS
    BAD_UUID,
    PARENT_ID,
    THROWN_MSG

(* --algorithm gwt0014ErrorPathOnBadUUID

variables
    sdkWillThrow   \in {TRUE, FALSE},
    wsOut          = <<>>,
    errorCount     = 0,
    completeCount  = 0,
    phase          = "Idle",
    mappedResumeAt = "";

define

    ValidPhase ==
        phase \in {"Idle", "Mapped", "Iterating", "CatchEmitted", "Finished"}

    ErrorEmittedOnThrow ==
        (sdkWillThrow /\ phase = "Finished") => errorCount = 1

    NoHalfState ==
        errorCount > 0 => completeCount = 0

    ErrorContentIsMessage ==
        \A i \in 1..Len(wsOut) :
            wsOut[i].kind = "error" => wsOut[i].content = THROWN_MSG

    NoPreflightNeeded ==
        phase /= "Idle" => mappedResumeAt = BAD_UUID

    AllInvariants ==
        /\ ValidPhase
        /\ ErrorEmittedOnThrow
        /\ NoHalfState
        /\ ErrorContentIsMessage
        /\ NoPreflightNeeded

end define;

fair process actor = "main"
begin
    MapOptions:
        mappedResumeAt := BAD_UUID;
        phase := "Mapped";

    StartQuery:
        phase := "Iterating";

    SDKIterateOrThrow:
        if sdkWillThrow then
            goto CatchEmit;
        else
            wsOut         := Append(wsOut, [kind |-> "complete", provider |-> "claude"]);
            completeCount := completeCount + 1;
            phase         := "Finished";
            goto Finish;
        end if;

    CatchEmit:
        wsOut      := Append(wsOut, [kind |-> "error", content |-> THROWN_MSG, provider |-> "claude"]);
        errorCount := errorCount + 1;
        phase      := "CatchEmitted";

    Rethrown:
        phase := "Finished";

    Finish:
        skip;

end process;

end algorithm; *)
\* BEGIN TRANSLATION (chksum(pcal) = "e3da2d65" /\ chksum(tla) = "91fc8c54")
VARIABLES pc, sdkWillThrow, wsOut, errorCount, completeCount, phase, 
          mappedResumeAt

(* define statement *)
ValidPhase ==
    phase \in {"Idle", "Mapped", "Iterating", "CatchEmitted", "Finished"}

ErrorEmittedOnThrow ==
    (sdkWillThrow /\ phase = "Finished") => errorCount = 1

NoHalfState ==
    errorCount > 0 => completeCount = 0

ErrorContentIsMessage ==
    \A i \in 1..Len(wsOut) :
        wsOut[i].kind = "error" => wsOut[i].content = THROWN_MSG

NoPreflightNeeded ==
    phase /= "Idle" => mappedResumeAt = BAD_UUID

AllInvariants ==
    /\ ValidPhase
    /\ ErrorEmittedOnThrow
    /\ NoHalfState
    /\ ErrorContentIsMessage
    /\ NoPreflightNeeded


vars == << pc, sdkWillThrow, wsOut, errorCount, completeCount, phase, 
           mappedResumeAt >>

ProcSet == {"main"}

Init == (* Global variables *)
        /\ sdkWillThrow \in {TRUE, FALSE}
        /\ wsOut = <<>>
        /\ errorCount = 0
        /\ completeCount = 0
        /\ phase = "Idle"
        /\ mappedResumeAt = ""
        /\ pc = [self \in ProcSet |-> "MapOptions"]

MapOptions == /\ pc["main"] = "MapOptions"
              /\ mappedResumeAt' = BAD_UUID
              /\ phase' = "Mapped"
              /\ pc' = [pc EXCEPT !["main"] = "StartQuery"]
              /\ UNCHANGED << sdkWillThrow, wsOut, errorCount, completeCount >>

StartQuery == /\ pc["main"] = "StartQuery"
              /\ phase' = "Iterating"
              /\ pc' = [pc EXCEPT !["main"] = "SDKIterateOrThrow"]
              /\ UNCHANGED << sdkWillThrow, wsOut, errorCount, completeCount, 
                              mappedResumeAt >>

SDKIterateOrThrow == /\ pc["main"] = "SDKIterateOrThrow"
                     /\ IF sdkWillThrow
                           THEN /\ pc' = [pc EXCEPT !["main"] = "CatchEmit"]
                                /\ UNCHANGED << wsOut, completeCount, phase >>
                           ELSE /\ wsOut' = Append(wsOut, [kind |-> "complete", provider |-> "claude"])
                                /\ completeCount' = completeCount + 1
                                /\ phase' = "Finished"
                                /\ pc' = [pc EXCEPT !["main"] = "Finish"]
                     /\ UNCHANGED << sdkWillThrow, errorCount, mappedResumeAt >>

CatchEmit == /\ pc["main"] = "CatchEmit"
             /\ wsOut' = Append(wsOut, [kind |-> "error", content |-> THROWN_MSG, provider |-> "claude"])
             /\ errorCount' = errorCount + 1
             /\ phase' = "CatchEmitted"
             /\ pc' = [pc EXCEPT !["main"] = "Rethrown"]
             /\ UNCHANGED << sdkWillThrow, completeCount, mappedResumeAt >>

Rethrown == /\ pc["main"] = "Rethrown"
            /\ phase' = "Finished"
            /\ pc' = [pc EXCEPT !["main"] = "Finish"]
            /\ UNCHANGED << sdkWillThrow, wsOut, errorCount, completeCount, 
                            mappedResumeAt >>

Finish == /\ pc["main"] = "Finish"
          /\ TRUE
          /\ pc' = [pc EXCEPT !["main"] = "Done"]
          /\ UNCHANGED << sdkWillThrow, wsOut, errorCount, completeCount, 
                          phase, mappedResumeAt >>

actor == MapOptions \/ StartQuery \/ SDKIterateOrThrow \/ CatchEmit
            \/ Rethrown \/ Finish

(* Allow infinite stuttering to prevent deadlock on termination. *)
Terminating == /\ \A self \in ProcSet: pc[self] = "Done"
               /\ UNCHANGED vars

Next == actor
           \/ Terminating

Spec == /\ Init /\ [][Next]_vars
        /\ WF_vars(actor)

Termination == <>(\A self \in ProcSet: pc[self] = "Done")

\* END TRANSLATION 

====
